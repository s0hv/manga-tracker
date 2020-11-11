import logging
import os
import random
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Type, ContextManager, TypedDict, Optional, Collection, List

import psycopg2
from psycopg2.extras import DictCursor, execute_values
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extensions import connection as Connection

from src.scrapers import SCRAPERS
from src.scrapers.base_scraper import BaseScraper
from src.utils.dbutils import DbUtil

logger = logging.getLogger('debug')


class MangaServiceInfo(TypedDict):
    manga_id: int
    title_id: str
    service_id: int
    feed_url: Optional[str]


class UpdateScheduler:
    MAX_POOLS = 5

    def __init__(self):
        config = {
            'db_host': os.environ['DB_HOST'],
            'db': os.environ['DB_NAME'],
            'db_user': os.environ['DB_USER'],
            'db_pass': os.environ['DB_PASSWORD'],
            'db_port': os.environ['DB_PORT']
        }

        self.pool = ThreadedConnectionPool(1, self.MAX_POOLS,
                                            host=config['db_host'],
                                            port=config['db_port'],
                                            user=config['db_user'],
                                            password=config['db_pass'],
                                            dbname=config['db'],
                                            cursor_factory=DictCursor)
        self.thread_pool = ThreadPoolExecutor(max_workers=self.MAX_POOLS-1)

    @contextmanager
    def conn(self) -> ContextManager[Connection]:
        conn = self.pool.getconn()
        try:
            conn.set_client_encoding('UTF8')
            if conn.get_parameter_status('timezone') != 'UTC':
                with conn.cursor() as cur:
                    cur.execute("SET TIMEZONE TO 'UTC'")
            yield conn
        except:
            conn.rollback()
        else:
            conn.commit()
        finally:
            self.pool.putconn(conn)

    def do_scheduled_runs(self) -> List[int]:
        # TODO maybe make these have some ratelimits as well
        with self.conn() as conn:
            sql = 'SELECT sr.manga_id, sr.service_id, ms.title_id FROM scheduled_runs sr ' \
                  'LEFT JOIN manga_service ms ON sr.manga_id = ms.manga_id AND sr.service_id = ms.service_id'

            delete = []
            manga_ids = []
            with conn.cursor() as cur:
                cur.execute(sql)

                for row in cur:
                    manga_id = row['manga_id']
                    service_id = row['service_id']
                    title_id = row['title_id']
                    if not title_id:
                        logger.error(f'Manga {manga_id} on service {service_id} scheduled but not found from manga service')
                        delete.append((manga_id, service_id))
                        continue

                    self.force_run(service_id, manga_id)
                    delete.append((manga_id, service_id))
                    manga_ids.append(manga_id)

            sql = '''
                DELETE FROM scheduled_runs sr
                    USING (VALUES %s) as c(manga_id, service_id)
                WHERE sr.manga_id=c.manga_id AND sr.service_id=c.service_id
            '''

            with conn.cursor() as cur:
                execute_values(cur, sql, delete)

            return manga_ids

    # noinspection PyPep8Naming
    def scrape_service(self,
                       service_id: int,
                       Scraper: Type[BaseScraper],
                       manga_info: Collection[MangaServiceInfo]):
        with self.conn() as conn:
            with conn:
                scraper = Scraper(conn, DbUtil(conn))
                rng = random.Random()
                manga_ids = set()
                errors = 0

                idx = 0
                for info in manga_info:
                    title_id = info['title_id']
                    manga_id = info['manga_id']
                    feed_url = info['feed_url']
                    logger.info(f'Updating {title_id} on service {service_id}')
                    try:
                        if res := scraper.scrape_series(title_id, service_id,
                                                        manga_id, feed_url) is True:
                            manga_ids.add(manga_id)
                        elif res is None:
                            errors += 1
                            logger.error(f'Failed to scrape series {title_id} {manga_id}')
                    except psycopg2.Error:
                        conn.rollback()
                        logger.exception(f'Database error while updating manga {title_id} on service {service_id}')
                        scraper.dbutil.update_manga_next_update(service_id, manga_id, scraper.next_update())
                        errors += 1
                    except:
                        conn.rollback()
                        logger.exception(f'Unknown error while updating manga {title_id} on service {service_id}')
                        scraper.dbutil.update_manga_next_update(service_id, manga_id, scraper.next_update())
                        errors += 1

                    if errors > 1:
                        break

                    idx += 1
                    if idx != len(manga_info):
                        time.sleep(rng.randint(5, 30))

                scraper.set_checked(service_id)

                return manga_ids

    def force_run(self, service_id: int, manga_id: int = None):
        with self.conn() as conn:
            if manga_id is not None:
                sql = '''
                    SELECT ms.service_id, s.url, ms.title_id, ms.manga_id, ms.feed_url, sw.feed_url as service_feed_url
                    FROM manga_service ms
                    INNER JOIN services s ON s.service_id=ms.service_id
                    LEFT JOIN service_whole sw ON s.service_id = sw.service_id
                    WHERE s.service_id=%s AND ms.manga_id=%s
                '''
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

                    title_id = row['title_id']
                    service_id = row['service_id']
                    manga_id = row['manga_id']
                    # Feed url is the feed url of the manga or if that's not defined
                    # the feed url of the service. Manga url always takes priority
                    feed_url = row['feed_url'] or row['service_feed_url']

                    logger.info(f'Force updating {title_id} on service {service_id}')
                    with conn:
                        try:
                            retval = scraper.scrape_series(title_id, service_id, manga_id, feed_url=feed_url)
                        except psycopg2.Error:
                            logger.exception(f'Database error while scraping {service_id} {scraper.NAME}: {title_id}')
                            return
                        except:
                            logger.exception(f'Failed to scrape service {service_id}')
                            return

                        if retval is None:
                            logger.error(f'Failed to scrape series {row}')
                            return

                    return retval

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
                with conn:
                    retval = scraper.scrape_service(row['service_id'], row['feed_url'], None)
                if retval:
                    manga_ids.update(retval)

                return manga_ids

    def run_once(self):
        with self.conn() as conn:
            futures = []
            sql = '''
                SELECT ms.service_id, s.url, array_agg(json_build_object('title_id', ms.title_id, 'manga_id', ms.manga_id, 'feed_url', ms.feed_url)) as manga_info
                FROM manga_service ms
                INNER JOIN services s ON s.service_id=ms.service_id
                WHERE NOT (s.disabled OR ms.disabled) AND (s.disabled_until IS NULL OR s.disabled_until < NOW()) AND (ms.next_update IS NULL OR ms.next_update < NOW())
                GROUP BY ms.service_id, s.url
            '''

            with conn.cursor() as cursor:
                cursor.execute(sql)

                manga_ids = set()
                for row in cursor:
                    batch_size = random.randint(3, 6)
                    Scraper = SCRAPERS.get(row['url'])
                    if not Scraper:
                        logger.error(f'Failed to find scraper for {row}')
                        continue

                    futures.append(self.thread_pool.submit(
                        self.scrape_service, row['service_id'],
                        Scraper, row['manga_info'][:batch_size]
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

                with conn:
                    try:
                        retval = scraper.scrape_service(service[0], service[1], None)
                    except psycopg2.Error:
                        logger.exception(f'Database error while scraping {service[1]}')
                        scraper.set_checked(service[0])
                        continue
                    except:
                        logger.exception(f'Failed to scrape service {service[1]}')
                        scraper.set_checked(service[0])
                        continue

                scraper.set_checked(service[0])
                if retval:
                    manga_ids.update(retval)

            conn.commit()

            retval = self.do_scheduled_runs()
            manga_ids.update(retval)

            with conn:
                if manga_ids:
                    logger.debug(f"Updating interval of {len(manga_ids)} manga")
                    dbutil = DbUtil(conn)
                    with conn.cursor() as cursor:
                        dbutil.update_latest_release(cursor, list(manga_ids))
                        for manga_id in manga_ids:
                            dbutil.update_chapter_interval(cursor, manga_id)

            sql = '''
            SELECT MIN(t.update) FROM (
                SELECT
                   LEAST(
                       GREATEST(MIN(ms.next_update), s.disabled_until),
                       (
                           SELECT MIN(GREATEST(sw.next_update, s2.disabled_until))
                           FROM service_whole sw 
                               INNER JOIN services s2 ON s2.service_id = sw.service_id 
                           WHERE s2.disabled=FALSE
                       )
                   ) as update
                FROM manga_service ms
                INNER JOIN services s ON s.service_id = ms.service_id
                WHERE s.disabled=FALSE AND ms.disabled=FALSE
                GROUP BY s.service_id, ms.service_id
            ) as t
            '''
            with conn.cursor() as cursor:
                cursor.execute(sql)
                retval = cursor.fetchone()
                if not retval:
                    return datetime.utcnow() + timedelta(hours=1)
                return retval[0]
