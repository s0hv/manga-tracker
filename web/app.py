import logging
import os
from contextlib import contextmanager
from datetime import timezone

import falcon
from feedgen.feed import FeedGenerator
from psycopg2.extras import DictCursor
from psycopg2.pool import ThreadedConnectionPool

from web.exceptions import ConversionError
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


def get_feed(limit=40, manga_id=None):
    if limit is None:
        limit = 40
    else:
        limit = to_int(limit, max_length=2)

    if manga_id is not None:
        manga_id = to_int(manga_id, max_length=9)

    limit = min(max(0, limit), 40)
    fg = FeedGenerator()
    fg.register_extension('manga', MangaExtension, MangaEntryExtension)
    fg.id('aaaa')
    fg.title('Test')
    fg.ttl(60)
    fg.language('en')
    fg.link(href='test')
    fg.description('test desc')

    if manga_id:
        sql = f'''SELECT c.chapter_id, m.title as manga_title, m.manga_id, c.title, c.chapter_number, c.release_date, c.chapter_identifier, s.service_name, s.chapter_url_format, s.url
                  FROM chapters c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id 
                  WHERE c.manga_id=%(manga_id)s AND c.release_date > NOW() - INTERVAL '1 hour'
                  UNION 
                      (SELECT c.chapter_id, m.title as manga_title, m.manga_id, c.title, c.chapter_number, c.release_date, c.chapter_identifier, s.service_name, s.chapter_url_format, s.url
                      FROM chapters c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id WHERE c.manga_id=%(manga_id)s 
                      LIMIT %(limit)s - (SELECT COUNT(*) FROM chapters WHERE manga_id=%(manga_id)s AND  release_date > NOW() - INTERVAL '1 hour')) 
                  ORDER BY release_date DESC, chapter_number DESC'''
    else:
        sql = f'''SELECT c.chapter_id, m.title as manga_title, m.manga_id, c.title, c.chapter_number, c.release_date, c.chapter_identifier, s.service_name, s.chapter_url_format, s.url
                  FROM chapters c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id 
                  WHERE c.release_date > NOW() - INTERVAL '1 hour'
                  UNION 
                      (SELECT c.chapter_id, m.title as manga_title, m.manga_id, c.title, c.chapter_number, c.release_date, c.chapter_identifier, s.service_name, s.chapter_url_format, s.url
                      FROM chapters c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id 
                      LIMIT %(limit)s - (SELECT COUNT(*) FROM chapters WHERE release_date > NOW() - INTERVAL '1 hour')) 
                  ORDER BY release_date DESC, chapter_id DESC
                  '''

    with get_cursor() as cursor:
        args = {'limit': limit}
        if manga_id:
            args['manga_id'] = manga_id

        cursor.execute(sql, args)
        for row in reversed(cursor.fetchall()):
            fe = fg.add_entry()
            fe.title(row['title'])
            fe.id(str(row['chapter_id']))
            fe.link(href=row['chapter_url_format'].format(
                row['chapter_identifier']))
            fe.source(title=row['service_name'], url=row['url'])
            fe.description(
                f'{row["manga_title"]} - Chapter {row["chapter_number"]}')
            fe.published(row['release_date'].astimezone(tz=timezone.utc))
            fe.manga.manga_id(str(row['manga_id']))

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

        resp.status = falcon.HTTP_200
        resp.content_type = falcon.MEDIA_XML
        resp.body = fg.rss_str(pretty=True)
