import logging
import os
import random
import time
from datetime import datetime, timedelta

import psycopg2
from psycopg2.extras import DictCursor

from src.scrapers.scraper_resolver import SCRAPERS
from src.utils.utilities import update_chapter_interval

logger = logging.getLogger('debug')

config = {
    'db_host': os.environ['DB_HOST'],
    'db': os.environ['DB_NAME'],
    'db_user': os.environ['DB_USER'],
    'db_pass': os.environ['DB_PASSWORD'],
    'db_port': os.environ['DB_PORT']
}


class UpdateScheduler:
    def __init__(self):
        self._conn = psycopg2.connect(host=config['db_host'],
                                      port=config['db_port'],
                                      user=config['db_user'],
                                      password=config['db_pass'],
                                      dbname=config['db'],
                                      cursor_factory=DictCursor)
        self._conn.set_client_encoding('UTF8')
        if self._conn.get_parameter_status('timezone') != 'UTC':
            with self._conn.cursor() as cur:
                cur.execute("SET TIMEZONE TO 'UTC'")

    @property
    def conn(self):
        return self._conn

    def run_once(self):
        sql = "SELECT ms.service_id, s.url, array_agg(ms.title_id) title_ids, array_agg(ms.manga_id) manga_ids " \
              "FROM manga_service ms " \
              "INNER JOIN services s ON s.service_id=ms.service_id " \
              "WHERE NOT (s.disabled OR ms.disabled) AND s.disabled_until < NOW() AND (ms.next_update IS NULL OR ms.next_update < NOW()) GROUP BY ms.service_id, s.url"

        with self.conn.cursor() as cursor:
            cursor.execute(sql)

            manga_ids = set()
            for row in cursor:
                batch_size = random.randint(3, 6)
                Scraper = SCRAPERS.get(row['url'])
                if not Scraper:
                    logger.error(f'Failed to find scraper for {row}')
                    continue

                scraper = Scraper(self.conn)

                for title_id, manga_id in zip(row['title_ids'][:batch_size], row['manga_ids'][:batch_size]):
                    logger.info(f'Updating {title_id}')
                    if scraper.scrape_series(title_id, row['service_id'], manga_id):
                        manga_ids.add(manga_id)
                    else:
                        logger.error(f'Failed to scrape series {row}')
                    time.sleep(random.randint(5, 10))

        sql = """SELECT s.service_id, sw.feed_url, s.url
                 FROM service_whole sw INNER JOIN services s on sw.service_id = s.service_id
                 WHERE NOT s.disabled AND (sw.next_update IS NULL OR sw.next_update < NOW())"""

        services = []
        with self.conn.cursor() as cursor:
            cursor.execute(sql)
            for row in cursor:
                services.append(row)

        for service in services:
            Scraper = SCRAPERS.get(service['url'])
            if not Scraper:
                logger.error(f'Failed to find scraper for {row}')
                continue

            scraper = Scraper(self.conn)
            logger.info(f'Updating service {service[2]}')
            retval = scraper.scrape_service(service[0], service[1], None)
            if retval:
                manga_ids.update(retval)

        with self.conn.cursor() as cursor:
            for manga_id in manga_ids:
                update_chapter_interval(cursor, manga_id)

        self.conn.commit()
        sql = 'SELECT LEAST(MIN(ms.next_update), (SELECT MIN(sw.next_update) FROM service_whole sw)) FROM manga_service ms'
        with self.conn.cursor() as cursor:
            cursor.execute(sql)
            retval = cursor.fetchone()
            if not retval:
                return datetime.utcnow() + timedelta(hours=1)
            return retval[0]
