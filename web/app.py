import logging
import os
from contextlib import contextmanager
from datetime import timezone

import falcon
from feedgen.feed import FeedGenerator
from psycopg2.extras import DictCursor
from psycopg2.pool import ThreadedConnectionPool

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


class Handler:
    def on_get(self, request, response):
        response.status = falcon.HTTP_200
        fg = FeedGenerator()
        fg.id('aaaa')
        fg.title('Test')
        fg.ttl(60)
        fg.language('en')
        fg.link(href='test')
        fg.description('test desc')

        sql = '''SELECT c.chapter_id, m.title as manga_title, c.title, c.chapter_number, c.release_date, c.chapter_identifier, s.service_name, s.chapter_url_format, s.url
                 FROM chapters c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id WHERE c.release_date > NOW() - INTERVAL '1 hour'
                 UNION SELECT c.chapter_id, m.title as manga_title, c.title, c.chapter_number, c.release_date, c.chapter_identifier, s.service_name, s.chapter_url_format, s.url
                 FROM chapters c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id ORDER BY release_date DESC, chapter_id
                 LIMIT 40 - (SELECT COUNT(*) FROM chapters WHERE release_date > NOW() - INTERVAL '1 hour')'''

        with get_cursor() as cursor:
            cursor.execute(sql)
            for row in reversed(cursor.fetchall()):
                fe = fg.add_entry()
                fe.title(row['title'])
                fe.id(str(row['chapter_id']))
                fe.link(href=row['chapter_url_format'].format(row['chapter_identifier']))
                fe.source(title=row['service_name'], url=row['url'])
                fe.description(f'{row["manga_title"]} - Chapter {row["chapter_number"]}')
                fe.published(row['release_date'].astimezone(tz=timezone.utc))

        response.content_type = falcon.MEDIA_XML
        response.body = fg.rss_str(pretty=True)
