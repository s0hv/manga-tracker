import logging
import os
import random
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta

import psycopg2
from psycopg2.extras import DictCursor
from psycopg2.pool import ThreadedConnectionPool

from src.scrapers import SCRAPERS
from src.utils.dbutils import DbUtil

logger = logging.getLogger('debug')

config = {
    'db_host': os.environ['DB_HOST'],
    'db': os.environ['DB_NAME'],
    'db_user': os.environ['DB_USER'],
    'db_pass': os.environ['DB_PASSWORD'],
    'db_port': os.environ['DB_PORT']
}


class UpdateScheduler:
    MAX_POOLS = 5

    def __init__(self):
        self.pool = ThreadedConnectionPool(1, self.MAX_POOLS,
                                            host=config['db_host'],
                                            port=config['db_port'],
                                            user=config['db_user'],
                                            password=config['db_pass'],
                                            dbname=config['db'],
                                            cursor_factory=DictCursor)
        self.thread_pool = ThreadPoolExecutor(max_workers=self.MAX_POOLS-1)

    @contextmanager
    def conn(self):
        conn = self.pool.getconn()
        try:
            conn.set_client_encoding('UTF8')
            if conn.get_parameter_status('timezone') != 'UTC':
                with conn.cursor() as cur:
                    cur.execute("SET TIMEZONE TO 'UTC'")
            yield conn
        finally:
            self.pool.putconn(conn)

    def scrape_service(self, service_id, Scraper, manga_info):
        with self.conn() as conn:
            scraper = Scraper(conn, DbUtil(conn))
            rng = random.Random()
            manga_ids = set()
            errors = 0

            idx = 0
            for title_id, manga_id in manga_info:
                logger.info(f'Updating {title_id} on service {service_id}')
                try:
                    if scraper.scrape_series(title_id, service_id, manga_id):
                        manga_ids.add(manga_id)
                    else:
                        errors += 1
                        logger.error(f'Failed to scrape series {manga_info}')
                except psycopg2.Error:
                    conn.rollback()
                    logger.exception(f'Database error while updating manga {title_id} on service {service_id}')
                    scraper.dbutil.update_manga_next_update(None, service_id, manga_id, scraper.min_update_interval())
                    errors += 1

                if errors > 1:
                    break

                idx += 1
                if idx != len(manga_info):
                    time.sleep(rng.randint(5, 30))

            scraper.set_checked(service_id)

            return manga_ids

    def force_run(self, service_id, manga_id=None):
        with self.conn() as conn:
            if manga_id is not None:
                sql = "SELECT ms.service_id, s.url, ms.title_id, ms.manga_id " \
                      "FROM manga_service ms " \
                      "INNER JOIN services s ON s.service_id=ms.service_id " \
                      "WHERE s.service_id=%s AND ms.manga_id=%s"
                with conn.cursor() as cursor:
                    cursor.execute(sql, (service_id, manga_id))
                    row = cursor.fetchone()
                    if not row:
                        logger.debug(f'Failed to find manga {manga_id} from service {service_id}')
                        return

                    Scraper = SCRAPERS.get(row['url'])
                    if not Scraper:
                        logger.error(f'Failed to find scraper for {row}')
                        return

                    scraper = Scraper(conn, DbUtil(conn))

                    logger.info(f'Updating {row["title_id"]}')
                    if not scraper.scrape_series(row["title_id"], row['service_id'],
                                                 row['manga_id']):
                        logger.error(f'Failed to scrape series {row}')

                    return row['manga_id']

            else:
                sql = """SELECT s.service_id, sw.feed_url, s.url
                         FROM service_whole sw INNER JOIN services s on sw.service_id = s.service_id
                         WHERE s.service_id=%s"""

                manga_ids = set()
                with conn.cursor() as cursor:
                    cursor.execute(sql, (service_id,))
                    row = cursor.fetchone()
                    if not row:
                        logger.debug(f'Failed to find service {service_id}')
                        return

                Scraper = SCRAPERS.get(row['url'])
                if not Scraper:
                    logger.error(f'Failed to find scraper for {row}')
                    return

                scraper = Scraper(conn, DbUtil(conn))
                logger.info(f'Updating service {row["url"]}')
                retval = scraper.scrape_service(row['service_id'], row['feed_url'], None)
                if retval:
                    manga_ids.update(retval)

                return manga_ids

    def run_once(self):
        with self.conn() as conn:
            futures = []
            sql = "SELECT ms.service_id, s.url, array_agg(ms.title_id) title_ids, array_agg(ms.manga_id) manga_ids " \
                  "FROM manga_service ms " \
                  "INNER JOIN services s ON s.service_id=ms.service_id " \
                  "WHERE NOT (s.disabled OR ms.disabled) AND (s.disabled_until IS NULL OR s.disabled_until < NOW()) AND (ms.next_update IS NULL OR ms.next_update < NOW()) GROUP BY ms.service_id, s.url"

            with conn.cursor() as cursor:
                cursor.execute(sql)

                manga_ids = set()
                for row in cursor:
                    batch_size = random.randint(3, 6)
                    Scraper = SCRAPERS.get(row['url'])
                    if not Scraper:
                        logger.error(f'Failed to find scraper for {row}')
                        continue

                    manga_info = []
                    for title_id, manga_id in zip(row['title_ids'][:batch_size],
                                                  row['manga_ids'][:batch_size]):

                        manga_info.append((title_id, manga_id))

                    futures.append(self.thread_pool.submit(
                        self.scrape_service, row['service_id'],
                        Scraper, manga_info
                    ))

            for r in futures:
                res = r.result()
                if isinstance(res, set):
                    manga_ids.update(res)

            sql = """SELECT s.service_id, sw.feed_url, s.url
                     FROM service_whole sw INNER JOIN services s on sw.service_id = s.service_id
                     WHERE NOT s.disabled AND (sw.next_update IS NULL OR sw.next_update < NOW())"""

            services = []
            with conn.cursor() as cursor:
                cursor.execute(sql)
                for row in cursor:
                    services.append(row)

            for service in services:
                Scraper = SCRAPERS.get(service['url'])
                if not Scraper:
                    logger.error(f'Failed to find scraper for {service}')
                    continue

                scraper = Scraper(conn, DbUtil(conn))
                logger.info(f'Updating service {service[2]}')
                try:
                    retval = scraper.scrape_service(service[0], service[1], None)
                except psycopg2.Error:
                    logger.exception(f'Database error while scraping {service[1]}')
                    continue

                scraper.set_checked(service[0])
                if retval:
                    manga_ids.update(retval)

            if manga_ids:
                logger.debug(f"Updating interval of {len(manga_ids)} manga")
                dbutil = DbUtil(conn)
                with conn.cursor() as cursor:
                    dbutil.update_latest_release(cursor, list(manga_ids))
                    for manga_id in manga_ids:
                        dbutil.update_chapter_interval(cursor, manga_id)

            sql = 'SELECT LEAST(MIN(ms.next_update), (SELECT MIN(sw.next_update) FROM service_whole sw)) FROM manga_service ms'
            with conn.cursor() as cursor:
                cursor.execute(sql)
                retval = cursor.fetchone()
                if not retval:
                    return datetime.utcnow() + timedelta(hours=1)
                return retval[0]
