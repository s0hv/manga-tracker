import logging
import statistics
import typing
from datetime import datetime, timedelta
from typing import (
    Union, Any, Optional, List, Dict, Generator, Tuple, Collection,
    Iterable, TypeVar, Callable, TYPE_CHECKING, cast, Set, Sequence
)

from psycopg2.extensions import connection as Connection, cursor as Cursor
from psycopg2.extras import execute_values, DictRow

from src.db.models.chapter import Chapter
from src.db.models.manga import (MangaService, Manga, MangaServicePartial,
                                 MangaServiceWithId)
from src.db.models.scheduled_run import ScheduledRun
from src.db.models.services import Service, ServiceWhole
from src.utils.utilities import round_seconds

if TYPE_CHECKING:
    # noinspection PyUnresolvedReferences
    from src.scrapers import base_scraper

logger = logging.getLogger('debug')
maintenance = logging.getLogger('maintenance')


BaseChapter = TypeVar('BaseChapter', bound='base_scraper.BaseChapter')
MangaModel = TypeVar('MangaModel', bound=Manga)

# Generic function that keeps signature for decorators
F = TypeVar('F', bound=Callable[..., Any])


def optional_generator_transaction(f: F) -> F:
    """
    Decorator that makes the cursor parameter optional except for generators
    """
    def wrapper(self: 'DbUtil', *args, **kwargs):
        if 'cur' in kwargs:
            for v in f(self, *args, **kwargs):
                yield v

        with self.conn:
            with self.conn.cursor() as cur:
                for v in f(self, *args, cur=cur, **kwargs):
                    yield v

    return cast(F, wrapper)


def optional_transaction(f: F) -> F:
    """
    Decorator that makes the cursor parameter optional
    """
    def wrapper(self: 'DbUtil', *args, **kwargs):
        if 'cur' in kwargs:
            return f(self, *args, **kwargs)

        with self.conn:
            with self.conn.cursor() as cur:
                return f(self, *args, cur=cur, **kwargs)

    return cast(F, wrapper)


class DbUtil:
    def __init__(self, conn: Connection):
        self._conn = conn

    @property
    def conn(self) -> Connection:
        return self._conn

    @optional_transaction
    def update_manga_next_update(self, service_id: int, manga_id: int,
                                 next_update: datetime, *, cur: Cursor = NotImplemented) -> None:
        sql = 'UPDATE manga_service SET next_update=%s WHERE manga_id=%s AND service_id=%s'
        cur.execute(sql, (next_update, manga_id, service_id))

    @optional_transaction
    def get_service_manga(self, service_id: int, include_only: Collection[int] = None,
                          *, cur: Cursor = NotImplemented) -> List[MangaServicePartial]:
        if include_only:
            raise NotImplementedError()
            # TODO filter by given manga
        else:
            args = (service_id,)
            sql = 'SELECT manga_id, title_id, last_check, latest_chapter, latest_decimal, service_id ' \
                  'FROM manga_service WHERE service_id=%s'

        cur.execute(sql, args)
        return list(map(MangaServicePartial.parse_obj, cur))

    @typing.overload
    @optional_transaction
    def get_service(self, service: int, *, cur: Cursor = NotImplemented) -> Optional[Service]: ...

    @typing.overload
    @optional_transaction
    def get_service(self, service: str, *, cur: Cursor = NotImplemented) -> Optional[Service]: ...

    @optional_transaction
    def get_service(self, service: Union[int, str], *, cur: Cursor = NotImplemented) -> Optional[Service]:
        """
        Get service by url or by id
        Args:
            service: The id or url of the service
            cur: Optional cursor

        Returns:
            Service object
        """
        if isinstance(service, int):
            sql = 'SELECT * FROM services WHERE service_id=%s'
        else:
            sql = 'SELECT * FROM services WHERE url=%s'

        cur.execute(sql, (service,))
        row = cur.fetchone()
        return Service(**row) if row else None

    @optional_transaction
    def set_service_disabled_until(self, service_id: int, disabled_until: datetime, *, cur: Cursor = NotImplemented):
        sql = 'UPDATE services SET disabled_until=%s WHERE service_id=%s'
        cur.execute(sql, (disabled_until, service_id))

    @staticmethod
    def get_scheduled_runs(cur: Cursor) -> Cursor:
        sql = 'SELECT sr.manga_id, sr.service_id, ms.title_id FROM scheduled_runs sr ' \
              'LEFT JOIN manga_service ms ON sr.manga_id = ms.manga_id AND sr.service_id = ms.service_id'

        cur.execute(sql)
        return cur

    @optional_transaction
    def delete_scheduled_runs(self, to_delete: List[Tuple[int, int]], *, cur: Cursor = NotImplemented) -> int:
        """
        Delete the given scheduled runs
        Args:
            cur: The cursor
            to_delete: List of manga id, service id pairs

        Returns:
            The amount of rows deleted
        """
        if not to_delete:
            return 0

        sql = '''
            DELETE FROM scheduled_runs sr
                USING (VALUES %s) as c(manga_id, service_id)
            WHERE sr.manga_id=c.manga_id AND sr.service_id=c.service_id
        '''
        execute_values(cur, sql, to_delete, page_size=len(to_delete))
        return cur.rowcount

    @optional_transaction
    def add_scheduled_runs(self, runs: List[ScheduledRun], *, cur: Cursor = NotImplemented):
        sql = 'INSERT INTO scheduled_runs (manga_id, service_id, created_by) VALUES %s'
        execute_values(cur, sql, [(sr.manga_id, sr.service_id, sr.created_by) for sr in runs])

    @optional_transaction
    def update_chapter_interval(self, manga_id: int, *, cur: Cursor = NotImplemented) -> bool:
        sql = '''
            SELECT MIN(release_date) as release_date, chapter_number
            FROM chapters
            WHERE manga_id=%s AND chapter_decimal IS NULL
            GROUP BY chapter_number
            ORDER BY chapter_number DESC LIMIT 30'''
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
            return False

        intervals = []
        accuracy = 60*60*4  # 4h
        for a, b in zip(chapters[:-1], chapters[1:]):
            t = round_seconds(
                (a['release_date']-b['release_date']).total_seconds(),
                accuracy
            )
            # Ignore updates within 4 hours of each other
            if t < accuracy:
                continue
            intervals.append(t)

        if not intervals:
            maintenance.info(f'Not enough valid intervals to calculate release interval for {manga_id}')
            return False

        # mode does not raise error since 3.8
        # https://docs.python.org/3/library/statistics.html#statistics.mode
        # Try to find a single most commonly occurring value.
        # If multiple values found fall back to median
        modes = statistics.multimode(intervals)
        if len(modes) > 1:
            interval_seconds = statistics.median(intervals)
        else:
            interval_seconds = modes[0]

        # TODO add warning when interval differs too much from mean
        interval = timedelta(seconds=interval_seconds)
        sql = 'UPDATE manga SET release_interval=%s WHERE manga_id=%s'
        logger.info(f'Interval for {manga_id} set to {interval}')
        cur.execute(sql, (interval, manga_id))
        return True

    @optional_transaction
    def get_chapters(self, service_id: int, manga_id: int, limit: int = 100, *, cur: Cursor = NotImplemented) -> List[Chapter]:
        sql = 'SELECT * FROM chapters WHERE service_id=%s AND manga_id=%s LIMIT %s'
        cur.execute(sql, (service_id, manga_id, limit))
        return list(map(Chapter.parse_obj, cur.fetchall()))

    @optional_transaction
    def manga_id_from_title(self, manga_title: str, service_id: int = None,
                                   *, cur: Cursor = NotImplemented) -> Optional[int]:
        """
        Tries to find a manga id by the title.
        If service id given will filter out manga from that service.
        Will return None if multiple matches found
        Args:
            manga_title: Title of the manga
            service_id: Optional id of the service
            cur: Optional cursor to use

        Returns:
            The id of the manga that matches the title or None in case the amount of results was 0 or more than 1
        """
        args: Tuple
        if service_id is None:
            sql = 'SELECT manga_id FROM manga WHERE LOWER(title)=LOWER(%s) LIMIT 2'
            args = (manga_title, )
        else:
            sql = 'SELECT m.manga_id FROM manga m ' \
                  'LEFT JOIN manga_service ms ON ms.service_id=%s AND ms.manga_id=m.manga_id ' \
                  'WHERE ms.service_id IS NULL AND LOWER(m.title)=LOWER(%s) LIMIT 2'
            args = (service_id, manga_title)

        cur.execute(sql, args)
        rows = cur.fetchall()
        if len(rows) > 1:
            logger.warning(f'Multiple matches for manga\n{rows}')
            return None

        if not rows:
            return None

        return rows[0][0]

    @optional_transaction
    def split_existing_manga(self, service_id: int, mangas: Collection[MangaModel],
                                  *, cur: Cursor = NotImplemented)\
            -> Tuple[List[MangaModel], List[MangaModel]]:
        """
        Given a collection of MangaService models that are not yet added to the database,
        this function splits the collection into two lists.
        The first list contains objects that have titles that already exist in the database
        and the other list contains objects that don't.

        The manga_id property will be set for the manga that already exist.

        This function should be called for manga of a single service only.

        Args:
            service_id: Id of the service the given manga belong to
            mangas: A collection of manga
            cur: Optional cursor

        Returns:
            (existing, non-existent) Tuple of two lists. One contains existing manga and the other non-existent manga
        """
        if not mangas:
            return [], []

        manga_titles: Dict[str, MangaModel] = {}
        duplicates: Set[str] = set()

        for manga in mangas:
            manga_title = manga.title.lower()
            if manga_title in duplicates:
                continue

            # In case of multiple titles with the same name ignore and resolve manually
            if manga_title in manga_titles:
                logger.warning(f'2 or more series with same name found {manga} AND {manga_titles[manga_title]}')
                manga_titles.pop(manga_title)
                duplicates.add(manga_title)
                continue

            manga_titles[manga_title] = manga

        # Create args in the format %s, %s, ...
        args = [(x,) for x in manga_titles.keys()]
        format_args = ','.join(['%s' for _ in args])
        already_exist = []

        if duplicates:
            logger.warning(f'All duplicates found {duplicates}')

        if format_args:
            # This sql filters out manga in this service already. This is because
            # this function assumes all series added in this function are new
            sql = f'SELECT MIN(manga.manga_id), LOWER(title), COUNT(manga.manga_id) as count ' \
                  f'FROM manga LEFT JOIN manga_service ms ON ms.service_id=%s AND manga.manga_id=ms.manga_id ' \
                  f'WHERE ms.manga_id IS NULL AND LOWER(title) IN ({format_args}) GROUP BY LOWER(title)'

            cur.execute(sql, (service_id, *args))

            for row in cur:
                if row['count'] == 1:
                    manga = manga_titles.pop(row[1])
                    manga.manga_id = row[0]
                    already_exist.append(manga)
                    continue

                logger.warning(f'Too many matches for manga {row[0]} {row[1]}')

        # All existing keys should be popped from the dict at this point
        return already_exist, list(manga_titles.values())

    @optional_transaction
    def add_new_manga_and_check_duplicate_titles(self, mangas: Sequence[MangaService],
                                                 *, cur: Cursor = NotImplemented) -> List[MangaServiceWithId]:
        """
        Given a sequence of new MangaService objects that are not in the database,
        this function adds them to the database while checking for duplicate titles.
        The manga id property is set for the returned objects.
        Args:
            mangas: MangaService objects
            cur: Optional cursor

        Returns:
            The manga that got added to the database
        """
        if not mangas:
            return []

        service_id = mangas[0].service_id

        exists, not_exists = self.split_existing_manga(service_id, mangas, cur=cur)
        exists.extend(self.add_new_mangas(not_exists, cur=cur))
        self.add_manga_services(exists, cur=cur)

        return list(map(MangaServiceWithId.parse_obj, exists))

    @optional_transaction
    def add_new_manga(self, manga: MangaModel, *, cur: Cursor = NotImplemented) -> MangaModel:
        """
        Adds a single manga to the database without any checks.
        Wrapper for add_new_mangas that works with single objects instead of lists.
        """
        return self.add_new_mangas([manga], cur=cur)[0]

    @optional_transaction
    def add_new_mangas(self, mangas: Collection[MangaModel], *, cur: Cursor = NotImplemented) -> List[MangaModel]:
        """
        Adds the given manga to the database and updates the manga_id property.
        Does not check if a duplicate exists
        Args:
            mangas: A collection of mangas to add
            cur: Optional cursor to use

        Returns:
            A list of the given mangas
        """
        if not mangas:
            return []

        args = [(
            manga.title,
            manga.release_interval,
            manga.latest_release,
            manga.estimated_release,
            manga.latest_chapter,
            manga.views
        )
            for manga in mangas]

        # Assume that RETURNING returns records in order
        sql = 'INSERT INTO manga ' \
              '(title, release_interval, latest_release, estimated_release, latest_chapter, views) ' \
              'VALUES %s RETURNING title, manga_id'
        rows = execute_values(cur, sql, args, page_size=len(args),
                              fetch=True)

        for row, manga in zip(rows, mangas):
            if row['title'] != manga.title:
                logger.warning(f'Inserted manga mismatch with {manga}')
                continue

            manga.manga_id = row['manga_id']

        return list(mangas)

    @optional_transaction
    def add_manga_service(self, manga: MangaService, *, add_manga: bool = False,
                          cur: Cursor = NotImplemented) -> MangaService:
        """
        Adds the given manga service object to the database.
        If add_manga is set to True will call add_new_manga first
        """
        if add_manga:
            self.add_new_manga(manga)

        return self.add_manga_services([manga], cur=cur)[0]

    @optional_transaction
    def add_manga_services(self, mangas: Collection[MangaService], *,
                           cur: Cursor = NotImplemented) -> List[MangaService]:
        """
        Adds the given manga service objects to the database
        """
        if not mangas:
            return []

        args = [
            (
                m.manga_id,
                m.service_id,
                m.disabled,
                m.last_check,
                m.title_id,
                m.next_update,
                m.latest_chapter,
                m.latest_decimal,
                m.feed_url
            ) for m in mangas
        ]
        sql = 'INSERT INTO manga_service ' \
              '(manga_id, service_id, disabled, last_check, title_id, next_update, latest_chapter, latest_decimal, feed_url)  ' \
              'VALUES %s RETURNING manga_id, title_id'

        rows = execute_values(cur, sql, args, page_size=len(args),
                              fetch=True)

        for row, manga in zip(rows, mangas):
            if row['title_id'] != manga.title_id:
                logger.warning(f'Inserted manga mismatch with {manga}')
                continue

            manga.manga_id = row['manga_id']

        return list(mangas)

    @optional_transaction
    def get_service_whole(self, service_id: int, *, cur: Cursor = NotImplemented) -> Optional[ServiceWhole]:
        sql = 'SELECT * FROM service_whole WHERE service_id=%s'
        cur.execute(sql, [service_id])
        row = cur.fetchone()

        return ServiceWhole(**row) if row else None

    @optional_transaction
    def update_service_whole(self, service_id: int, update_interval: timedelta, *, cur: Cursor = NotImplemented) -> None:
        sql = 'UPDATE services SET last_check=%s WHERE service_id=%s'
        now = datetime.utcnow()
        cur.execute(sql, [now, service_id])

        sql = 'UPDATE service_whole SET last_check=%s, next_update=%s WHERE service_id=%s'
        cur.execute(sql, [now, now + update_interval, service_id])

    @optional_generator_transaction
    def find_added_titles(self, service_id: int, title_ids: Collection[str], *, cur: Cursor = NotImplemented) -> Generator[MangaServicePartial, None, None]:
        if len(title_ids) == 0:
            return None

        format_ids = ','.join(['%s'] * len(title_ids))
        sql = f'SELECT * FROM manga_service WHERE service_id=%s AND title_id IN ({format_ids})'
        cur.execute(sql, [service_id, *title_ids])
        for row in cur:
            yield MangaServicePartial(**row)

    @optional_transaction
    def find_service_manga(self, service_id: int, title_id: str, *, cur: Cursor = NotImplemented) -> DictRow:
        sql = 'SELECT * from manga_service WHERE service_id=%s AND title_id=%s'
        cur.execute(sql, (service_id, title_id))
        return cur.fetchone()

    @optional_transaction
    def get_manga_service(self, service_id: int, title_id: str, *, cur: Cursor = NotImplemented) -> Optional[MangaService]:
        sql = 'SELECT * FROM manga_service ms ' \
              'INNER JOIN manga m ON ms.manga_id = m.manga_id ' \
              'WHERE service_id=%s AND ms.title_id=%s'

        cur.execute(sql, (service_id, title_id))
        row = cur.fetchone()
        return MangaService(**row) if row else None

    @optional_transaction
    def get_manga(self, manga_id: int, *, cur: Cursor = NotImplemented) -> Optional[Manga]:
        """
        Get manga object from database
        """
        sql = 'SELECT * FROM manga WHERE manga_id=%s'
        cur.execute(sql, (manga_id, ))
        row = cur.fetchone()
        return Manga(**row) if row else None

    @optional_transaction
    def update_latest_release(self, data: Collection[int], *, cur: Cursor = NotImplemented) -> None:
        format_ids = ','.join(['%s'] * len(data))
        sql = 'UPDATE manga m SET latest_release=c.release_date FROM ' \
              f'(SELECT MAX(release_date), manga_id FROM chapters WHERE manga_id IN ({format_ids}) GROUP BY manga_id) as c(release_date, manga_id)' \
              'WHERE m.manga_id=c.manga_id'
        cur.execute(sql, data)

    @typing.overload
    @optional_transaction
    def add_chapters(self, chapters: Sequence[BaseChapter], manga_id: int,
                     service_id: int, *, fetch: bool = True, cur: Cursor = NotImplemented) -> Optional[List[DictRow]]: ...

    @typing.overload
    @optional_transaction
    def add_chapters(self, chapters: Sequence[Chapter], *, fetch: bool = True, cur: Cursor = NotImplemented) -> Optional[List[DictRow]]: ...

    @optional_transaction
    def add_chapters(self, chapters: Union[Sequence[Chapter], Sequence[BaseChapter]],
                     manga_id: int = None, service_id: int = None, *, fetch: bool = True, cur: Cursor = NotImplemented) -> Optional[List[DictRow]]:
        if not chapters:
            return None

        data: List[Tuple]
        if isinstance(chapters[0], Chapter):
            chapters = cast(Sequence[Chapter], chapters)
            data = [
                (
                    c.manga_id, c.service_id, c.title,
                    c.chapter_number, c.chapter_decimal,
                    c.chapter_identifier, c.release_date,
                    c.group
                ) for c in chapters
            ]
        else:
            chapters = cast(Sequence[BaseChapter], chapters)
            data = [
                (
                    manga_id, service_id, chapter.title,
                    chapter.chapter_number, chapter.decimal,
                    chapter.chapter_identifier,
                    chapter.release_date, chapter.group
                ) for chapter in chapters
            ]

        sql = 'INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_decimal, chapter_identifier, release_date, "group") VALUES ' \
              '%s ON CONFLICT DO NOTHING'
        if fetch:
            sql += ' RETURNING manga_id, chapter_number, chapter_decimal, release_date, chapter_identifier'

        return execute_values(cur, sql, data, page_size=max(len(data), 300), fetch=fetch)

    @optional_transaction
    def update_latest_chapter(self, data: Collection[Tuple[int, int, datetime]], *, cur: Cursor = NotImplemented) -> None:
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
    def update_estimated_release(self, manga_id: int, *, cur: Cursor = NotImplemented) -> None:
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
            maintenance.warning("Nothing updated because manga id doesn't exist or release_interval was NULL")
            return

        row = rows[0]
        maintenance.info(f'Set estimated release from {row["estimated_release_old"]} to {row["estimated_release"]}')
        return row

    @optional_transaction
    def update_chapter_titles(self, service_id: int, chapters: Iterable[BaseChapter], *, cur: Cursor = NotImplemented):
        service_id = int(service_id)

        sql = f'''
        UPDATE chapters
        SET title=c.title
        FROM (VALUES %s) AS c(title, id)
        WHERE service_id={service_id} AND chapter_identifier=c.id
        '''

        execute_values(cur, sql, [(c.title, c.chapter_identifier) for c in chapters], page_size=200)

    @optional_transaction
    def get_only_latest_entries(self,
                                service_id: int,
                                entries: Collection[BaseChapter],
                                manga_id: int = None,
                                limit: int = 400,
                                *, cur: Cursor = NotImplemented) -> Collection[BaseChapter]:
        if len(entries) > 200:
            logger.warning('Over 200 entries passed to get_only_latest_entries')

        args: Tuple = tuple(c.chapter_identifier for c in entries)
        format_args = ','.join(('%s',) * len(args))

        if manga_id:
            sql = 'SELECT chapter_identifier FROM chapters ' \
                  f'WHERE service_id=%s AND manga_id=%s AND chapter_identifier IN ({format_args})'
            args = (service_id, manga_id, *args)
        else:
            sql = 'SELECT chapter_identifier FROM chapters ' \
                  f'WHERE service_id=%s AND chapter_identifier IN ({format_args})'
            args = (service_id, *args)

        try:
            cur.execute(sql, args)

            return set(entries).difference(set(r[0] for r in cur))

        except:
            logger.exception('Failed to get old chapters')
            return list(entries)

    @optional_transaction
    def set_manga_last_checked(self, service_id: int, manga_id: int,
                               last_checked: Optional[datetime], *, cur: Cursor = NotImplemented):
        sql = 'UPDATE manga_service SET last_check=%s WHERE manga_id=%s AND service_id=%s'
        cur.execute(sql, [last_checked, manga_id, service_id])

    @optional_transaction
    def get_newest_chapter(self, manga_id: int, service_id: Optional[int] = None,
                           *, cur: Cursor = NotImplemented):
        sql = f'SELECT * FROM chapters WHERE manga_id=%s{" AND service_id=%s" if service_id is not None else ""} ORDER BY release_date DESC LIMIT 1'
        args = (manga_id,) if service_id is None else (manga_id, service_id)

        cur.execute(sql, args)
        return cur.fetchone()
