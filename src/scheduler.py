from src.utils.utilities import update_chapter_interval

import random

import psycopg2
from psycopg2.extras import DictCursor


class UpdateScheduler:
    def __init__(self, config):
        self._conn = psycopg2.connect(host=config['db_host'],
                                      port=config['db_port'],
                                      user=config['db_user'],
                                      password=config['db_pass'],
                                      dbname=config['db'],
                                      cursor_factory=DictCursor)
        self._conn.set_client_encoding('UTF8')

    @property
    def conn(self):
        return self._conn

    def schedule_loop(self):
        while True:
            sql = "SELECT ms.service_id, s.service_name, ms.title_id, ms.manga_id " \
                  "FROM manga_service ms " \
                  "INNER JOIN services s ON s.service_id=ms.service_id " \
                  "WHERE NOT (s.disabled OR ms.disabled) AND (ms.next_update IS NULL OR ms.next_update < NOW())"

            services = {}
            with self.conn.cursor() as cursor:
                cursor.execute(sql)
                for row in cursor:
                    service_id = row['service_id']
                    if service_id in services:
                        services[service_id].append(row)
                    else:
                        services[service_id] = [row]

            manga_ids = set()
            for row in services.values():
                batch_size = random.randint(3, 6)
                scraper = None
                for series in row[:batch_size]:
                    from src.scrapers.mangaplus import MangaPlus
                    mp = MangaPlus(self.conn)
                    mp.scrape_series(series['title_id'], series['service_id'], series['manga_id'])
                    manga_ids.add(series['manga_id'])

            sql = """SELECT s.service_id, sw.feed_url, s.url
                     FROM service_whole sw INNER JOIN services s on sw.service_id = s.service_id
                     WHERE NOT s.disabled AND (sw.next_update IS NULL OR sw.next_update < NOW())"""

            services = []
            with self.conn.cursor() as cursor:
                cursor.execute(sql)
                for row in cursor:
                    services.append(row)

            for service in services:
                from src.scrapers.mangadex import MangaDex
                md = MangaDex(self.conn)
                retval = md.scrape_service(service[0], service[1], None)
                if retval:
                    manga_ids.update(retval)

            with self.conn.cursor() as cursor:
                for manga_id in manga_ids:
                    update_chapter_interval(cursor, manga_id)

            self.conn.commit()

            return
