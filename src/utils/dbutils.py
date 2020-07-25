import logging
import statistics
from datetime import datetime, timedelta
from typing import Union, Any, Protocol, Optional, List, Dict, Generator, Tuple, \
    Collection

from psycopg2.extensions import connection as Connection, cursor as Cursor
from psycopg2.extras import execute_values, DictRow

from src.scrapers import base_scraper
from src.utils.utilities import round_seconds

logger = logging.getLogger('debug')
maintenance = logging.getLogger('maintenance')


class TransactionFunction(Protocol):
    def __call__(self, cur: Cursor, *args, **kwargs) -> Any: ...


def optional_transaction(f: TransactionFunction):
    """
    Decorator that makes the cursor parameter optional
    """
    def wrapper(self, cur: Union[Cursor, Any], *args, **kwargs):
        if isinstance(cur, Cursor):
            return f(self, cur, *args, **kwargs)

        with self.conn:
            with self.conn.cursor() as innerCur:
                return f(self, innerCur, cur, *args, **kwargs)

    return wrapper


class DbUtil:
    def __init__(self, conn: Connection):
        self._conn = conn

    @property
    def conn(self) -> Connection:
        return self._conn

    @staticmethod
    def fuzzy_search_manga(cur: Cursor, title: str, limit: int = 10, return_rows: bool = True) -> Union[Cursor, List[DictRow]]:
        """
        Does a fuzzy search of manga and returns the closest matches
        Args:
            cur: The cursor that is being used
            title (str): The query string that the titles are being matched against
            limit (int): A limit on how many rows can be returned. Cannot be None
            return_rows (bool): If set to True will return rows in a list. Otherwise
                will return `cur`

        Returns:
            list or `cur` depending on `return_rows`

        """
        sql = """
            SELECT m.manga_id, m.title, m.latest_release
            FROM manga m 
            LEFT JOIN manga_alias ma on m.manga_id = ma.manga_id
            GROUP BY m.manga_id
            ORDER BY GREATEST(
                            MIN(m.title) ILIKE '%' || %(title)s || '%', 
                        bool_or(ma.title ILIKE '%' || %(title)s || '%')
                     ) DESC,
                     LEAST(MIN(m.title <-> %(title)s), MIN(COALESCE(ma.title <-> %(title)s, 1))) LIMIT %(limit)s
            """

        cur.execute(sql, {'title': title, 'limit': limit})

        if return_rows:
            return cur.fetchall()

        return cur

    @optional_transaction
    def update_manga_next_update(self, cur: Cursor, service_id: int, manga_id: int, next_update: datetime):
        sql = 'UPDATE manga_service SET next_update=%s WHERE manga_id=%s AND service_id=%s'
        cur.execute(sql, (next_update, manga_id, service_id))

    @optional_transaction
    def get_service_manga(self, cur: Cursor, service_id: int, include_only=None) -> list:
        if include_only:
            # TODO filter by given manga
            args = (service_id,)
            sql = 'SELECT manga_id, title_id, last_check, latest_chapter, latest_decimal FROM manga_service WHERE service_id=%s'
        else:
            args = (service_id,)
            sql = 'SELECT manga_id, title_id, last_check, latest_chapter, latest_decimal FROM manga_service WHERE service_id=%s'

        cur.execute(sql, args)
        return cur.fetchall()

    @optional_transaction
    def get_service(self, cur: Cursor, service_url: str) -> Optional[DictRow]:
        sql = 'SELECT service_id FROM services WHERE url=%s'
        cur.execute(sql, (service_url,))
        row = cur.fetchone()
        return row[0] if row else None

    @optional_transaction
    def set_service_updates(self, cur: Cursor, service_id: int, disabled_until: datetime):
        sql = 'UPDATE services SET disabled_until=%s WHERE service_id=%s'
        cur.execute(sql, (disabled_until, service_id))

    @optional_transaction
    def update_chapter_interval(self, cur: Cursor, manga_id: int) -> None:
        sql = 'SELECT MIN(release_date) release_date, chapter_number FROM chapters WHERE manga_id=%s GROUP BY chapter_number, chapter_decimal ORDER BY chapter_number DESC, chapter_decimal DESC NULLS LAST LIMIT 30'
        cur.execute(sql, (manga_id,))
        chapters = []
        last = None
        for c in cur:
            if not last:
                last = c
                chapters.append(c)
                continue

            if last['chapter_number']-c['chapter_number'] > 2:
                break
            last = c
            chapters.append(c)

        if len(chapters) < 2:
            maintenance.info(f'Not enough chapters to calculate release interval for {manga_id}')
            return

        intervals = []
        accuracy = 60*60*4
        for a, b in zip(chapters[:-1], chapters[1:]):
            t = a['release_date']-b['release_date']
            t = round_seconds(t.total_seconds(), accuracy)
            # Ignore updates within 4 hours of each other
            if t < accuracy:
                continue
            intervals.append(t)

        if not intervals:
            maintenance.info(f'Not enough valid intervals to calculate release interval for {manga_id}')
            return

        try:
            interval = statistics.mode(intervals)
        except statistics.StatisticsError:
            interval = statistics.mean(intervals)
            interval = round_seconds(interval, accuracy)

        interval = timedelta(seconds=interval)
        sql = 'UPDATE manga SET release_interval=%s WHERE manga_id=%s'
        logger.info(f'Interval for {manga_id} set to {interval}')
        cur.execute(sql, (interval, manga_id))

    @staticmethod
    def add_new_series(cur: Cursor, manga_chapters: Dict[str, List['base_scraper.BaseChapter']],
                       service_id: int, disable_single_update: bool = False) -> Optional[Generator[Tuple[int, List['base_scraper.BaseChapter']], None, None]]:
        """

        Args:
            cur:
            manga_chapters (dict): title_id: chapters.
                chapters must have a single element with the attributes manga_title and title_id
            service_id:
            disable_single_update:

        Returns:

        """
        manga_titles = {}
        duplicates = set()

        for title_id, chapters in manga_chapters.items():
            chapter = chapters[0]
            manga_title = chapter.manga_title.lower()
            if manga_title in duplicates:
                continue

            # In case of multiple titles with the same name ignore and resolve manually
            if manga_title in manga_titles:
                logger.warning(f'2 or more series with same name found {chapter} AND {manga_titles[manga_title][0]}')
                manga_titles.pop(manga_title)
                duplicates.add(manga_title)
                continue

            manga_titles[manga_title] = chapters

        args = [(x,) for x in manga_titles.keys()]
        format_args = ','.join(['%s' for _ in args])
        # This sql filters out manga in this service already. This is because
        # this function assumes all series added in this function are new
        sql = f'SELECT MIN(manga.manga_id), LOWER(title), COUNT(manga.manga_id) ' \
              f'FROM manga LEFT JOIN manga_service ms ON ms.service_id=%s AND manga.manga_id=ms.manga_id ' \
              f'WHERE ms.manga_id IS NULL AND LOWER(title) IN ({format_args}) GROUP BY LOWER(title)'

        cur.execute(sql, (service_id, *args))

        if duplicates:
            logger.warning(f'All duplicates found {duplicates}')

        already_exist = []
        now = datetime.utcnow()
        for row in cur:
            if row[2] == 1:
                chapters = manga_titles.pop(row[1])
                yield row[0], chapters
                already_exist.append((row[0], service_id, disable_single_update, now, chapters[0].title_id))
                continue

            logger.warning(f'Too many matches for manga {row[1]}')

        new_manga = []
        titles = []

        if already_exist:
            sql = '''INSERT INTO manga_service (manga_id, service_id, disabled, last_check, title_id) VALUES %s 
                     ON CONFLICT DO NOTHING'''
            execute_values(cur, sql, already_exist, page_size=len(already_exist))

        if not manga_titles:
            return

        id2chapters = {}
        for chapters in manga_titles.values():
            titles.append((chapters[0].manga_title,))
            new_manga.append(chapters)

        sql = 'INSERT INTO manga (title) VALUES %s RETURNING manga_id, title'
        rows = execute_values(cur, sql, titles, page_size=len(titles), fetch=True)

        args = []
        for row, chapters in zip(rows, new_manga):
            chapter = chapters[0]
            if chapter.manga_title != row[1]:
                logger.warning(f'Inserted manga mismatch with {chapter}')
                continue

            args.append((row[0], service_id, disable_single_update, now, chapter.title_id))
            id2chapters[row[0]] = chapters

        sql = '''INSERT INTO manga_service (manga_id, service_id, disabled, last_check, title_id) VALUES 
                 %s RETURNING manga_id'''

        rows = execute_values(cur, sql, args, page_size=len(args), fetch=True)
        for row in rows:
            yield row[0], id2chapters[row[0]]

    @optional_transaction
    def update_service_whole(self, cur: Cursor, service_id: int, update_interval: timedelta) -> None:
        sql = 'UPDATE services SET last_check=%s WHERE service_id=%s'
        now = datetime.utcnow()
        cur.execute(sql, [now, service_id])

        sql = 'UPDATE service_whole SET last_check=%s, next_update=%s WHERE service_id=%s'
        cur.execute(sql, [now, now + update_interval, service_id])

    @staticmethod
    def find_added_titles(cur: Cursor, title_ids: Collection[str]) -> Generator[DictRow, None, None]:
        format_ids = ','.join(['%s'] * len(title_ids))
        sql = f'SELECT manga_id, title_id FROM manga_service WHERE title_id IN ({format_ids})'
        cur.execute(sql, title_ids)
        for row in cur:
            yield row

    @optional_transaction
    def update_latest_release(self, cur: Cursor, data: Collection[int]) -> None:
        format_ids = ','.join(['%s'] * len(data))
        sql = 'UPDATE manga m SET latest_release=c.release_date FROM ' \
              f'(SELECT MAX(release_date), manga_id FROM chapters WHERE manga_id IN ({format_ids}) GROUP BY manga_id) as c(release_date, manga_id)' \
              'WHERE m.manga_id=c.manga_id'
        cur.execute(sql, data)

    @optional_transaction
    def update_latest_chapter(self, cur: Cursor, data: Collection[Tuple[int, int, datetime]]) -> None:
        """
        Updates the latest chapter and next chapter estimates for the given manga that contain new chapters
        Args:
            cur: Optional database cursor
            data: iterable of tuples or lists [manga_id, latest_chapter, release_date]

        Returns:
            None
        """
        if not data:
            return

        format_ids = ','.join(['%s'] * len(data))
        sql = f'SELECT latest_chapter, manga_id FROM manga WHERE manga_id IN ({format_ids})'
        cur.execute(sql, [d[0] for d in data])
        rows = cur.fetchall()
        if not rows:
            return

        # Filter latest chapters
        rows = {r[1]: r[0] for r in rows}
        data = [d for d in data if rows[d[0]] is None or rows[d[0]] < d[1]]
        if not data:
            return

        sql = 'UPDATE manga m SET latest_chapter=c.latest_chapter, estimated_release=c.release_date + release_interval FROM ' \
              ' (VALUES %s) as c(manga_id, latest_chapter, release_date) ' \
              'WHERE c.manga_id=m.manga_id'
        execute_values(cur, sql, data)

    @optional_transaction
    def update_estimated_release(self, cur: Cursor, manga_id: int) -> None:
        sql = 'WITH tmp AS (SELECT MAX(chapter_number) as chn FROM chapters WHERE manga_id=%(manga)s) ' \
              'UPDATE manga SET estimated_release=(' \
              ' SELECT MIN(release_date) FROM chapters ' \
              '     WHERE manga_id=%(manga)s AND ' \
              '           chapter_number=(SELECT chn FROM tmp) AND ' \
              '           chapter_decimal IS NOT DISTINCT FROM (SELECT MAX(chapter_decimal) FROM chapters WHERE manga_id= %(manga)s AND chapter_number=(SELECT chn FROM tmp))' \
              ') + release_interval ' \
              'WHERE manga_id=%(manga)s AND release_interval IS NOT NULL ' \
              'RETURNING estimated_release, (SELECT estimated_release FROM manga WHERE manga_id=%(manga)s) as estimated_release_old'

        cur.execute(sql, {'manga': manga_id})
        rows = cur.fetchall()
        if not rows:
            maintenance.info("Nothing updated because manga id doesn't exist or release_interval was NULL")
            return

        row = rows[0]
        maintenance.info(f'Set estimated release from {row["estimated_release_old"]} to {row["estimated_release"]}')
