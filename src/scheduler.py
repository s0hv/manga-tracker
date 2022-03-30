import logging
import os
import random
import time
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timedelta
from itertools import groupby
from operator import attrgetter
from typing import Type, ContextManager, TypedDict, Optional, Collection, List, \
    Set, cast, Tuple, Dict

import psycopg2
from concurrent.futures import ThreadPoolExecutor
from psycopg2.extensions import connection as Connection
from psycopg2.extras import DictCursor
from psycopg2.pool import ThreadedConnectionPool

from src.db.mappers.notifications_mapper import NotificationsMapper
from src.db.models.chapter import Chapter
from src.notifier import NOTIFIERS
from src.scrapers import SCRAPERS, SCRAPERS_ID
from src.scrapers.base_scraper import BaseScraper
from src.utils.dbutils import DbUtil
from src.utils.utilities import inject_service_values

logger = logging.getLogger('debug')
db_logger = logging.getLogger('database')


class MangaServiceInfo(TypedDict):
    manga_id: int
    title_id: str
    service_id: int
    feed_url: str


class LoggingDictCursor(DictCursor):
    # noinspection PyShadowingBuiltins
    def execute(self, query, vars=None):
        try:
            return super(LoggingDictCursor, self).execute(query, vars)
        finally:
            if isinstance(self.query, bytes):
                db_logger.debug(self.query.decode('utf-8'))
            else:
                db_logger.debug(self.query)


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

        self.pool = ThreadedConnectionPool(
            1,
            self.MAX_POOLS,
            host=config['db_host'],
            port=config['db_port'],
            user=config['db_user'],
            password=config['db_pass'],
            dbname=config['db'],
            cursor_factory=LoggingDictCursor
        )
        self.thread_pool = ThreadPoolExecutor(max_workers=self.MAX_POOLS-1)

        with self.conn() as conn:
            inject_service_values(DbUtil(conn))

    # Workaround described in https://youtrack.jetbrains.com/issue/PY-36444
    # Required for mypy pass and PyCharm autocompletion
    def conn(self) -> ContextManager[Connection]:
        @contextmanager
        def wrapper():
            conn: Connection = self.pool.getconn()
            try:
                conn.set_client_encoding('UTF8')
                if conn.get_parameter_status('timezone') != 'UTC':
                    with conn.cursor() as cur:
                        cur.execute("SET TIMEZONE TO 'UTC'")
                yield conn
            except Exception:
                conn.rollback()
                raise
            else:
                conn.commit()
            finally:
                self.pool.putconn(conn)

        return wrapper()

    def do_scheduled_runs(self) -> Tuple[List[int], List[int]]:
        with self.conn() as conn:
            dbutil = DbUtil(conn)
            delete = []
            manga_ids = []
            chapter_ids = []
            service_counter: Counter = Counter()

            disabled_services = set(map(attrgetter('service_id'), filter(attrgetter('disabled'), dbutil.get_services())))

            for sr in dbutil.get_scheduled_runs():
                manga_id = sr.manga_id
                service_id = sr.service_id
                title_id = sr.title_id
                Service = SCRAPERS_ID[service_id]

                if not Service.CONFIG.scheduled_runs_enabled:
                    logger.warning(f'Tried to schedule run for service {Service.__name__} when it does not support scheduled runs.')
                    delete.append((manga_id, service_id))
                    continue

                if service_id in disabled_services:
                    logger.warning(f'Tried to schedule run for service {Service.__name__} when it is disabled.')
                    delete.append((manga_id, service_id))
                    continue

                if service_counter.get(service_id, 0) >= Service.CONFIG.scheduled_run_limit:
                    continue

                service_counter.update((service_id,))

                if not title_id:
                    logger.error(f'Manga {manga_id} on service {service_id} scheduled but not found from manga service')
                    delete.append((manga_id, service_id))
                    continue

                retval = self.force_run(service_id, manga_id)
                delete.append((manga_id, service_id))
                manga_ids.append(manga_id)
                if retval:
                    _, chs = retval
                    chapter_ids.extend(chs)

            dbutil.delete_scheduled_runs(delete)
            dbutil.update_scheduled_run_disabled(list(service_counter.keys()))

            return manga_ids, chapter_ids

    # noinspection PyPep8Naming
    def scrape_service(self,
                       service_id: int,
                       Scraper: Type[BaseScraper],
                       manga_info: Collection[MangaServiceInfo]) -> Tuple[Set[int], List[int]]:
        with self.conn() as conn:
            with conn:
                scraper = Scraper(conn, DbUtil(conn))
                rng = random.Random()
                manga_ids: Set[int] = set()
                chapter_ids: List[int] = []
                errors = 0

                idx = 0
                for info in manga_info:
                    title_id = info['title_id']
                    manga_id = info['manga_id']
                    feed_url = info['feed_url']
                    logger.info(f'Updating {title_id} on service {service_id}')
                    try:
                        if res := scraper.scrape_series(title_id, service_id,
                                                        manga_id, feed_url):
                            manga_ids.add(manga_id)
                            chapter_ids.extend(res)
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
                        time.sleep(rng.randint(200, 1000)/100)

                scraper.set_checked(service_id)

                return manga_ids, chapter_ids

    def force_run(self, service_id: int, manga_id: int = None) -> Optional[Tuple[Set[int], List[int]]]:
        if service_id not in SCRAPERS_ID:
            logger.warning(f'No service found with id {service_id}')
            return None

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
                    return None

                Scraper = SCRAPERS.get(row['url'])
                if not Scraper:
                    logger.error(f'Failed to find scraper for {row}')
                    return None

                scraper = Scraper(conn)

                title_id: str = row['title_id']
                manga_id = cast(int, row['manga_id'])
                # Feed url is the feed url of the manga or if that's not defined
                # the feed url of the service. Manga url always takes priority
                feed_url: str = row['feed_url'] or row['service_feed_url']

                logger.info(f'Force updating {title_id} on service {service_id}')
                with conn:
                    try:
                        retval = scraper.scrape_series(title_id, service_id, manga_id, feed_url=feed_url)
                    except psycopg2.Error:
                        logger.exception(f'Database error while scraping {service_id} {scraper.NAME}: {title_id}')
                        return None
                    except:
                        logger.exception(f'Failed to scrape service {service_id}')
                        return None

                    if retval is None:
                        logger.error(f'Failed to scrape series {row}')
                        return None

                return {manga_id}, list(retval)

            else:
                sql = """SELECT s.service_id, sw.feed_url, s.url
                         FROM service_whole sw INNER JOIN services s on sw.service_id = s.service_id
                         WHERE s.service_id=%s"""

                manga_ids: Set[int] = set()
                chapter_ids: List[int] = []
                with conn.cursor() as cursor:
                    cursor.execute(sql, (service_id,))
                    row = cursor.fetchone()
                    if not row:
                        logger.debug(f'Failed to find service {service_id}')
                        return None

                Scraper = SCRAPERS.get(row['url'])
                if not Scraper:
                    logger.error(f'Failed to find scraper for {row}')
                    return None

                scraper = Scraper(conn, DbUtil(conn))
                logger.info(f'Updating service {row["url"]}')
                with conn:
                    updated = scraper.scrape_service(row['service_id'], row['feed_url'], None)
                if updated:
                    manga_ids.update(updated.manga_ids)
                    chapter_ids.extend(updated.chapter_ids)

                return manga_ids, chapter_ids

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

                manga_ids: Set[int] = set()
                chapter_ids: List[int] = []
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
                    manga_ids.update(retval.manga_ids)
                    chapter_ids.extend(retval.chapter_ids)

            conn.commit()

            m_ids, c_ids = self.do_scheduled_runs()
            manga_ids.update(m_ids)
            chapter_ids.extend(c_ids)

            for r in futures:
                res = r.result()
                if isinstance(res, tuple):
                    manga_ids.update(res[0])
                    chapter_ids.extend(res[1])

            with conn:
                if manga_ids:
                    logger.debug(f"Updating interval of {len(manga_ids)} manga")
                    dbutil = DbUtil(conn)
                    with conn.cursor() as cursor:
                        dbutil.update_latest_release(list(manga_ids), cur=cursor)
                        for manga_id in manga_ids:
                            dbutil.update_chapter_interval(manga_id, cur=cursor)

            try:
                self.send_notifications(manga_ids, chapter_ids)
            except:
                logger.exception('Failed to send notifications')

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

    def send_notifications(self, manga_ids: Set[int], chapter_ids: List[int]):
        if not (manga_ids and chapter_ids):
            return

        with self.conn() as conn:
            dbutil = DbUtil(conn)

            partial_notifications = dbutil.get_notifications_by_manga_ids(list(manga_ids))
            manga_ids = {pn.manga_id for pn in partial_notifications}
            if not manga_ids:
                return

            def get_manga_id(chapter: Chapter) -> int:
                return chapter.manga_id

            chapters = sorted(dbutil.get_chapters_by_id(chapter_ids, list(manga_ids)), key=get_manga_id)
            chapter_by_manga: Dict[int, List[Chapter]] = {}

            for group, chapter_it in groupby(chapters, key=get_manga_id):
                chapter_by_manga[group] = list(chapter_it)

            notifications: Dict[int, List[Chapter]] = {
                pn.notification_id: [] for pn in partial_notifications
            }

            for partial_notification in partial_notifications:
                selected_chapters = chapter_by_manga.get(partial_notification.manga_id, [])
                if partial_notification.service_id is not None:
                    selected_chapters = [c for c in selected_chapters
                                         if c.service_id == partial_notification.service_id]

                notifications[partial_notification.notification_id].extend(selected_chapters)

            services = {s.service_id: s for s in dbutil.get_services()}
            mangas = dbutil.get_mangas_for_notifications(list(manga_ids))

            mapped_notifications = {
                k: NotificationsMapper.chapter_to_notification(v, services, mangas)
                for k, v in notifications.items()
                if v
            }

            for notification_id, chapters_notif in mapped_notifications.items():
                notification = dbutil.get_notification_info(notification_id)
                notifier = NOTIFIERS[notification.notification_type]()

                input_fields = dbutil.get_notification_inputs(notification_id)

                sent, success = notifier.send_notification(
                    chapters_notif,
                    notification,
                    input_fields
                )

                dbutil.update_notification_stats(
                    notification_id,
                    sent,
                    0 if success else 1
                )
