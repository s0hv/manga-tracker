import logging
import os
from contextlib import contextmanager
from datetime import timezone

import falcon
from feedgen.feed import FeedGenerator
from psycopg2.extras import DictCursor
from psycopg2.pool import ThreadedConnectionPool

from web.exceptions import ConversionError, NotFound
from web.manga_extension import MangaEntryExtension, MangaExtension

logger = logging.getLogger('debug')
config = {
    'db_host': os.environ['DB_HOST'],
    'db': os.environ['DB_NAME'],
    'db_user': os.environ['DB_USER'],
    'db_pass': os.environ['DB_PASSWORD'],
    'db_port': os.environ['DB_PORT']
}

pool = ThreadedConnectionPool(3, 10,
                              host=config['db_host'],
                              port=config['db_port'],
                              user=config['db_user'],
                              password=config['db_pass'],
                              dbname=config['db'],
                              cursor_factory=DictCursor)


@contextmanager
def get_cursor():
    conn = pool.getconn()
    conn.set_client_encoding('utf-8')
    try:
        yield conn.cursor()
    finally:
        pool.putconn(conn)


def to_int(val: [str, int], max_length=None):
    if isinstance(val, int):
        return val

    try:
        if max_length and len(val) > max_length:
            raise ConversionError('Value too long')

        return int(val, 10)
    except (ValueError, TypeError):
        raise ConversionError('Failed to convert to int')


def get_feed(limit=40, manga_id=None, service_id=None, user_id=None):
    if limit is None:
        limit = 40
    else:
        limit = to_int(limit, max_length=2)

    if manga_id is not None:
        manga_id = to_int(manga_id, max_length=9)

    if service_id is not None:
        service_id = to_int(service_id, max_length=6)

    if user_id is not None:
        if len(user_id) != 32:
            raise NotFound

    limit = min(max(0, limit), 40)
    fg = FeedGenerator()
    fg.register_extension('manga', MangaExtension, MangaEntryExtension)
    fg.id('aaaa')
    fg.title('Test')
    fg.ttl(60)
    fg.language('en')
    fg.link(href='test')
    fg.description('test desc')

    whereclause = []
    join = ''
    cte = 'WITH chapters_filtered AS (SELECT chapter_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, c.service_id, c.manga_id FROM chapters c {} {} ORDER BY release_date DESC, chapter_number DESC)'

    if user_id:
        whereclause.append('u.user_uuid=%(user_id)s::uuid')
        join = 'INNER JOIN user_follows uf ON c.manga_id = uf.manga_id AND (uf.service_id IS NULL OR c.service_id=uf.service_id) ' \
               'INNER JOIN users u ON u.user_id=uf.user_id'
    else:
        if manga_id:
            whereclause.append('c.manga_id=%(manga_id)s')
        if service_id:
            whereclause.append('c.service_id=%(service_id)%')

    if whereclause:
        whereclause = 'WHERE ' + ' AND '.join(whereclause)
    else:
        whereclause = ''

    cte = cte.format(join, whereclause)

    sql = cte +\
      ''' 
         SELECT c.chapter_id, m.title as manga_title, m.manga_id, m.release_interval, c.title, c.chapter_number, c.chapter_decimal, c.release_date, c.chapter_identifier, s.service_name, s.chapter_url_format, s.url
         FROM chapters_filtered c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id 
         WHERE c.release_date > NOW() - INTERVAL '1 hour'
         UNION 
              (SELECT c.chapter_id, m.title as manga_title, m.manga_id, m.release_interval, c.title, c.chapter_number, c.chapter_decimal, c.release_date, c.chapter_identifier, s.service_name, s.chapter_url_format, s.url
              FROM chapters_filtered c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id
              LIMIT %(limit)s)
         ORDER BY release_date DESC, chapter_number DESC'''

    with get_cursor() as cursor:
        args = {'limit': limit}
        if manga_id:
            args['manga_id'] = manga_id
        if service_id:
            args['service_id'] = service_id
        if user_id:
            args['user_id'] = user_id

        cursor.execute(sql, args)
        rows = cursor.fetchall()
        print(len(rows), limit)
        for row in reversed(rows):
            fe = fg.add_entry()
            fe.title(row['title'])
            fe.id(str(row['chapter_id']))
            fe.link(href=row['chapter_url_format'].format(row['chapter_identifier']))
            fe.source(title=row['service_name'], url=row['url'])
            fe.description(f'{row["manga_title"]} - Chapter {row["chapter_number"]}')
            fe.published(row['release_date'].astimezone(tz=timezone.utc))
            fe.manga.manga_id(str(row['manga_id']))
            fe.manga.manga_title(row['manga_title'])

            if row['release_interval']:
                fe.manga.release_interval(row['release_interval'])

    return fg


class Handler:
    def on_get(self, req, resp):
        try:
            fg = get_feed(**req.params)
        except ConversionError as e:
            resp.status = falcon.HTTP_400
            resp.content_type = falcon.MEDIA_JSON
            resp.media = {'Error': str(e)}
            return
        except NotFound:
            resp.status = falcon.HTTP_404
            return

        resp.status = falcon.HTTP_200
        resp.content_type = falcon.MEDIA_XML
        resp.body = fg.rss_str(pretty=True)
