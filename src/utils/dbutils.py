import logging
import statistics
from datetime import datetime, timedelta

from psycopg2.extras import execute_values

from src.utils.utilities import round_seconds

logger = logging.getLogger('debug')


def optional_transaction(f):
    """
    Decorator that makes the cursor parameter optional
    """
    def wrapper(self, cur, *args, **kwargs):
        if cur:
            return f(self, cur, *args, **kwargs)

        with self.conn:
            with self.conn.cursor() as cur:
                return f(self, cur, *args, **kwargs)

    return wrapper


class DbUtil:
    def __init__(self, conn):
        self._conn = conn

    @property
    def conn(self):
        return self._conn

    @staticmethod
    def fuzzy_search_manga(cur, title: str, limit: int=10, return_rows: bool=True):
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
    def update_manga_next_update(self, cur, service_id, manga_id, next_update):
        sql = 'UPDATE manga_service SET next_update=%s WHERE manga_id=%s AND service_id=%s'
        cur.execute(sql, (next_update, manga_id, service_id))

    @optional_transaction
    def set_service_updates(self, cur, service_id, disabled_until):
        sql = 'UPDATE services SET disabled_until=%s WHERE service_id=%s'
        cur.execute(sql, (disabled_until, service_id))

    @optional_transaction
    def update_chapter_interval(self, cur, manga_id):
        sql = 'SELECT MIN(release_date) release_date, chapter_number FROM chapters WHERE manga_id=%s GROUP BY chapter_number ORDER BY chapter_number DESC LIMIT 30'
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
            return

        try:
            interval = statistics.mode(intervals)
        except statistics.StatisticsError:
            interval = statistics.mean(intervals)
            interval = round_seconds(interval, accuracy)

        interval = timedelta(seconds=interval)
        sql = 'UPDATE manga SET release_interval=%s WHERE manga_id=%s'
        cur.execute(sql, (interval, manga_id))

    @staticmethod
    def add_new_series(cur, manga_chapters: dict, service_id, disable_single_update: bool=False):
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
                already_exist.append((row[0], service_id, disable_single_update, now, chapters[0].manga_id))
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

            args.append((row[0], service_id, disable_single_update, now, chapter.manga_id))
            id2chapters[row[0]] = chapters

        sql = '''INSERT INTO manga_service (manga_id, service_id, disabled, last_check, title_id) VALUES 
                 %s RETURNING manga_id'''

        rows = execute_values(cur, sql, args, page_size=len(args), fetch=True)
        for row in rows:
            yield row[0], id2chapters[row[0]]

    @optional_transaction
    def update_service_whole(self, cur, service_id, update_interval):
        sql = 'UPDATE services SET last_check=%s WHERE service_id=%s'
        now = datetime.utcnow()
        cur.execute(sql, [now, service_id])

        sql = 'UPDATE service_whole SET last_check=%s, next_update=%s WHERE service_id=%s'
        cur.execute(sql, [now, now + update_interval, service_id])

    @staticmethod
    def find_added_titles(cur, title_ids):
        format_ids = ','.join(['%s'] * len(title_ids))
        sql = f'SELECT manga_id, title_id FROM manga_service WHERE title_id IN ({format_ids})'
        cur.execute(sql, title_ids)
        for row in cur:
            yield row

    @optional_transaction
    def update_latest_release(self, cur, data):
        format_ids = ','.join(['%s'] * len(data))
        sql = 'UPDATE manga m SET latest_release=c.release_date FROM ' \
              f'(SELECT MAX(release_date), manga_id FROM chapters WHERE manga_id IN ({format_ids}) GROUP BY manga_id) as c(release_date, manga_id)' \
              'WHERE m.manga_id=c.manga_id'
        cur.execute(sql, data)

    @optional_transaction
    def update_latest_chapter(self, cur, data):
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
