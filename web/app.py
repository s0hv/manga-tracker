from gevent import monkey, pywsgi
monkey.patch_all()
import falcon
from contextlib import contextmanager

from feedgen.feed import FeedGenerator
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import DictCursor
import json
import os


with open(os.path.join('..', 'config', 'config.json'), encoding='utf-8') as f:
    config = json.load(f)

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
                 FROM chapters c INNER JOIN manga m on c.manga_id = m.manga_id INNER JOIN services s on c.service_id = s.service_id ORDER BY release_date, chapter_id
                 LIMIT 20 - (SELECT COUNT(*) FROM chapters WHERE release_date > NOW() - INTERVAL '1 hour')'''

        with get_cursor() as cursor:
            cursor.execute(sql)
            for row in cursor:
                fe = fg.add_entry()
                fe.title(row['title'])
                fe.id(str(row['chapter_id']))
                fe.link(href=row['chapter_url_format'].format(row['chapter_identifier']))
                fe.source(title=row['service_name'], url=row['url'])
                fe.description(f'{row["manga_title"]} - Chapter {row["chapter_number"]}')

        response.content_type = falcon.MEDIA_XML
        response.body = fg.rss_str(pretty=True)


api = falcon.API(media_type=falcon.MEDIA_XML)
api.add_route("/", Handler())
port = 9090
server = pywsgi.WSGIServer(("localhost", port), api)
print(f'Live on http://localhost:{port}')
server.serve_forever()
