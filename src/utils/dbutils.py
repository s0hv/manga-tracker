import logging
import statistics
from collections.abc import (
    Callable,
    Collection,
    Generator,
    Iterable,
    Iterator,
    Sequence,
)
from datetime import datetime, timedelta
from functools import wraps
from itertools import groupby, pairwise
from typing import TYPE_CHECKING, Any, LiteralString, TypeVar, cast, overload

from psycopg import Connection, Cursor
from psycopg.rows import DictRow, RowFactory, class_row, dict_row

from src.db.errors import RowNotFound
from src.db.models.authors import Author, AuthorPartial, MangaArtist, MangaAuthor
from src.db.models.chapter import Chapter, InsertedChapter
from src.db.models.groups import Group, GroupPartial
from src.db.models.manga import (
    Manga,
    MangaForNotifications,
    MangaInfo,
    MangaService,
    MangaServicePartial,
    MangaServicePartialWithId,
    MangaServiceWithId,
)
from src.db.models.notifications import (
    InputField,
    PartialNotificationInfo,
    UserNotification,
)
from src.db.models.scheduled_run import ScheduledRun, ScheduledRunResult
from src.db.models.services import Service, ServiceConfig, ServiceWhole
from src.db.utilities import execute_values
from src.elasticsearch.methods import ElasticMethods
from src.utils.utilities import round_seconds, utcnow

if TYPE_CHECKING:
    # noinspection PyUnresolvedReferences
    from src.scrapers import base_scraper

logger = logging.getLogger('debug')
maintenance = logging.getLogger('maintenance')

BaseChapter = TypeVar('BaseChapter', bound='base_scraper.BaseChapter')
MangaModel = TypeVar('MangaModel', bound=Manga)
MangaServiceBound = TypeVar('MangaServiceBound', bound=MangaService)
CursorType = Cursor[DictRow]

T = TypeVar('T')


def optional_generator_transaction[**P, T](f: Callable[P, Iterator[T]]) -> Callable[P, Iterator[T]]:
    """
    Decorator that makes the cursor parameter optional except for generators
    """

    @wraps(f)
    def wrapper(*args: P.args, **kwargs: P.kwargs):
        if 'cur' in kwargs:
            for v in f(*args, **kwargs):
                yield v

        dbutil = cast('DbUtil', args[0])
        with dbutil.conn.transaction(), dbutil.conn.cursor() as cur:
            kwargs['cur'] = cur
            for v in f(*args, **kwargs):
                yield v

    return wrapper


class OptionalTransaction[Row = DictRow]:
    def __init__(self, row_factory: RowFactory[Row] | None = None):
        self.row_factory = row_factory

    def __call__[T, **P](self, f: Callable[P, T]) -> Callable[P, T]:
        """
        Decorator that makes the cursor parameter optional
        """

        @wraps(f)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            dbutil = cast('DbUtil', args[0])
            if 'cur' in kwargs:
                # Restore original row factory if needed
                cur: Cursor[Row] = cast(Cursor[Row], kwargs['cur'])
                original_factory = cur.row_factory
                if self.row_factory:
                    cur.row_factory = self.row_factory
                retval = f(*args, **kwargs)
                if self.row_factory:
                    cur.row_factory = original_factory

                return retval

            with (
                dbutil.conn.transaction(),
                dbutil.conn.cursor(row_factory=self.row_factory or dict_row) as new_cur,
            ):
                kwargs['cur'] = new_cur
                return f(*args, **kwargs)

        return wrapper


class DbUtil:
    def __init__(self, conn: Connection[DictRow], es: ElasticMethods | None):
        self._conn = conn
        self._es = es

    @property
    def conn(self) -> Connection[DictRow]:
        return self._conn

    @property
    def es(self) -> ElasticMethods:
        if self._es is None:
            raise ValueError('ElasticMethods instance not given')
        return self._es

    @staticmethod
    def get_format_args(val: Collection | int) -> str:
        """
        Joins n %s signs together
        """
        length = val if isinstance(val, int) else len(val)
        return ','.join(['%s'] * length)

    @staticmethod
    def fetchone_or_throw(cur: Cursor[T]) -> T:
        row = cur.fetchone()
        if row is None:
            raise RowNotFound()

        return row

    @OptionalTransaction()
    def execute[T = DictRow](
        self,
        sql: str,
        args: Collection[Any] | None = None,
        *,
        fetch: bool | None = None,
        cur: Cursor[T] = NotImplemented,
    ) -> list[T]:
        """
        Easy way for tests to call sql functions. Should not be used outside of tests.
        """
        if fetch is None:
            fetch = sql.upper().startswith('SELECT')

        args_list: Sequence | None = None
        if args:
            args_list = list(args)

        cur.execute(sql, args_list)
        if fetch:
            return cur.fetchall()

        return []

    @OptionalTransaction()
    def update_manga_next_update(
        self,
        service_id: int,
        manga_id: int,
        next_update: datetime,
        *,
        cur: CursorType = NotImplemented,
    ) -> None:
        sql = 'UPDATE manga_service SET next_update=%s WHERE manga_id=%s AND service_id=%s'
        cur.execute(sql, (next_update, manga_id, service_id))

    @OptionalTransaction()
    def get_service_manga(
        self,
        service_id: int,
        include_only: Collection[int] | None = None,
        *,
        cur: CursorType = NotImplemented,
    ) -> list[MangaServicePartial]:
        if include_only:
            raise NotImplementedError()
            # TODO filter by given manga
        else:
            args = (service_id,)
            sql = (
                'SELECT manga_id, title_id, last_check, latest_chapter, latest_decimal, service_id '
                'FROM manga_service WHERE service_id=%s'
            )

        cur.execute(sql, args)
        return list(map(MangaServicePartial.model_validate, cur))

    @overload
    @OptionalTransaction()
    def get_service(self, service: int, *, cur: CursorType = NotImplemented) -> Service | None: ...

    @overload
    @OptionalTransaction()
    def get_service(self, service: str, *, cur: CursorType = NotImplemented) -> Service | None: ...

    @OptionalTransaction()
    def get_service(
        self, service: int | str, *, cur: CursorType = NotImplemented
    ) -> Service | None:
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

    @OptionalTransaction()
    def set_service_disabled_until(
        self, service_id: int, disabled_until: datetime, *, cur: CursorType = NotImplemented
    ) -> None:
        sql = 'UPDATE services SET disabled_until=%s WHERE service_id=%s'
        cur.execute(sql, (disabled_until, service_id))

    @OptionalTransaction()
    def get_scheduled_runs(self, *, cur: CursorType = NotImplemented) -> list[ScheduledRunResult]:
        """
        Get scheduled runs ordered by creation time. Checks if runs are on cooldown
        """
        sql = """
            SELECT sr.manga_id, sr.service_id, ms.title_id FROM scheduled_runs sr
            LEFT JOIN manga_service ms ON sr.manga_id = ms.manga_id AND sr.service_id = ms.service_id
            INNER JOIN services s ON s.service_id = sr.service_id
            WHERE s.scheduled_runs_disabled_until IS NULL OR s.scheduled_runs_disabled_until < NOW()
            ORDER BY created_at
        """

        cur.execute(sql)
        return list(map(ScheduledRunResult.model_validate, cur))

    @OptionalTransaction()
    def get_all_scheduled_runs(
        self, *, cur: CursorType = NotImplemented
    ) -> list[ScheduledRunResult]:
        sql = (
            'SELECT sr.manga_id, sr.service_id, ms.title_id FROM scheduled_runs sr '
            'LEFT JOIN manga_service ms ON sr.manga_id = ms.manga_id AND sr.service_id = ms.service_id'
        )

        cur.execute(sql)
        return list(map(ScheduledRunResult.model_validate, cur))

    @OptionalTransaction()
    def update_scheduled_run_disabled(
        self, service_ids: list[int], *, cur: CursorType = NotImplemented
    ) -> None:
        """
        Disables scheduled runs for the given services for the time defined in their config
        """
        if not service_ids:
            return

        format_args = self.get_format_args(service_ids)
        sql = (
            'UPDATE services s '
            'SET scheduled_runs_disabled_until=NOW() + sc.scheduled_run_interval '
            'FROM service_config sc '
            f'WHERE sc.service_id = s.service_id AND s.service_id IN ({format_args})'
        )

        cur.execute(sql, service_ids)

    @OptionalTransaction()
    def delete_scheduled_runs(
        self, to_delete: list[tuple[int, int]], *, cur: CursorType = NotImplemented
    ) -> int:
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

        sql = """
            DELETE FROM scheduled_runs sr
            USING (VALUES %s) AS c(manga_id, service_id)
            WHERE sr.manga_id = c.manga_id AND sr.service_id = c.service_id
        """
        execute_values(cur, sql, to_delete, page_size=len(to_delete))
        return cur.rowcount

    @OptionalTransaction()
    def add_scheduled_runs(
        self, runs: list[ScheduledRun], *, cur: CursorType = NotImplemented
    ) -> None:
        sql = 'INSERT INTO scheduled_runs (manga_id, service_id, created_by) VALUES %s'
        execute_values(cur, sql, [(sr.manga_id, sr.service_id, sr.created_by) for sr in runs])

    @OptionalTransaction()
    def update_chapter_interval(self, manga_id: int, *, cur: CursorType = NotImplemented) -> bool:
        sql = """
              SELECT MIN(release_date) AS release_date, chapter_number
              FROM chapters
              WHERE manga_id = %s
                AND chapter_decimal IS NULL
              GROUP BY chapter_number
              ORDER BY chapter_number DESC
              LIMIT 30"""
        cur.execute(sql, (manga_id,))
        chapters = []
        last = None
        for c in cur:
            if not last:
                last = c
                chapters.append(c)
                continue

            if last['chapter_number'] - c['chapter_number'] > 2:
                break
            last = c
            chapters.append(c)

        if len(chapters) < 2:
            maintenance.info(f'Not enough chapters to calculate release interval for {manga_id}')
            return False

        intervals = []
        accuracy = 60 * 60 * 4  # 4h
        # Iterate over pairs of pairwise chapters
        for a, b in pairwise(chapters):
            t = round_seconds((a['release_date'] - b['release_date']).total_seconds(), accuracy)
            # Ignore updates within 4 hours of each other
            if t < accuracy:
                continue
            intervals.append(t)

        if not intervals:
            maintenance.info(
                f'Not enough valid intervals to calculate release interval for {manga_id}'
            )
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

    @OptionalTransaction()
    def get_chapters_by_id(
        self, chapter_ids: list[int], manga_ids: list[int], cur: CursorType = NotImplemented
    ) -> list[Chapter]:
        if not chapter_ids:
            return []

        sql = (
            'SELECT c.*, g.name AS "group" FROM chapters c '
            'INNER JOIN groups g ON g.group_id=c.group_id '
            'WHERE chapter_id=ANY(%s) AND manga_id=ANY(%s) '
        )
        cur.execute(sql, (chapter_ids, manga_ids))
        return list(map(Chapter.model_validate, cur))

    @overload
    def get_chapters(
        self, manga_id: int, *, limit: int = 100, cur: CursorType = NotImplemented
    ) -> list[Chapter]: ...

    @overload
    def get_chapters(
        self, manga_id: int, service_id: int, *, limit: int = 100, cur: CursorType = NotImplemented
    ) -> list[Chapter]: ...

    @overload
    def get_chapters(
        self, manga_id: None, service_id: int, *, limit: int = 100, cur: CursorType = NotImplemented
    ) -> list[Chapter]: ...

    @OptionalTransaction()
    def get_chapters(
        self,
        manga_id: int | None,
        service_id: int | None = None,
        *,
        limit: int = 100,
        cur: CursorType = NotImplemented,
    ) -> list[Chapter]:
        args: tuple
        if service_id is None:
            sql = 'SELECT * FROM chapters WHERE manga_id=%s LIMIT %s'
            args = (manga_id, limit)
        else:
            if manga_id is None:
                sql = 'SELECT * FROM chapters WHERE service_id=%s LIMIT %s'
                args = (service_id, limit)
            else:
                sql = 'SELECT * FROM chapters WHERE manga_id=%s AND service_id=%s LIMIT %s'
                args = (manga_id, service_id, limit)

        cur.execute(sql, args)
        return list(map(Chapter.model_validate, cur.fetchall()))

    @OptionalTransaction()
    def manga_id_from_title(
        self, manga_title: str, service_id: int | None = None, *, cur: CursorType = NotImplemented
    ) -> int | None:
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
        args: tuple
        sql: LiteralString
        if service_id is None:
            sql = 'SELECT manga_id FROM manga WHERE LOWER(title)=LOWER(%s) LIMIT 2'
            args = (manga_title,)
        else:
            sql = """
                  SELECT m.manga_id FROM manga m
                    LEFT JOIN manga_service ms ON ms.service_id = %s AND ms.manga_id = m.manga_id
                  WHERE ms.service_id IS NULL AND LOWER(m.title) = LOWER(%s)
                  LIMIT 2
                  """
            args = (service_id, manga_title)

        cur.execute(sql, args)
        rows = cur.fetchall()
        if len(rows) > 1:
            logger.warning(f'Multiple matches for manga\n{rows}')
            return None

        if not rows:
            return None

        return rows[0]['manga_id']

    @OptionalTransaction()
    def split_existing_manga[TManga: Manga = Manga](
        self, service_id: int, mangas: Collection[TManga], *, cur: CursorType = NotImplemented
    ) -> tuple[list[TManga], list[TManga]]:
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

        manga_titles: dict[str, TManga] = {}
        duplicates: set[str] = set()

        for manga in mangas:
            manga_title = manga.title.lower()
            if manga_title in duplicates:
                continue

            # In case of multiple titles with the same name ignore and resolve manually
            if manga_title in manga_titles:
                logger.warning(
                    f'2 or more series with same name found {manga} AND {manga_titles[manga_title]}'
                )
                manga_titles.pop(manga_title)
                duplicates.add(manga_title)
                continue

            manga_titles[manga_title] = manga

        # Create args in the format %s, %s, ...
        args = list(manga_titles.keys())
        format_args = ','.join(['%s' for _ in args])
        already_exist = []

        if duplicates:
            logger.warning(f'All duplicates found {duplicates}')

        if format_args:
            # This sql filters out manga in this service already. This is because
            # this function assumes all series added in this function are new
            sql = (
                f'SELECT MIN(manga.manga_id) as manga_id, LOWER(title) as title, COUNT(manga.manga_id) as count '
                f'FROM manga LEFT JOIN manga_service ms ON ms.service_id=%s AND manga.manga_id=ms.manga_id '
                f'WHERE ms.manga_id IS NULL AND LOWER(title) IN ({format_args}) GROUP BY LOWER(title)'
            )

            cur.execute(sql, (service_id, *args))

            for row in cur:
                if row['count'] == 1:
                    manga = manga_titles.pop(row['title'])
                    manga.manga_id = row['manga_id']
                    already_exist.append(manga)
                    continue

                logger.warning(f'Too many matches for manga {row["manga_id"]} {row["title"]}')

        # All existing keys should be popped from the dict at this point
        return already_exist, list(manga_titles.values())

    @OptionalTransaction()
    def add_new_manga_and_check_duplicate_titles(
        self, mangas: Sequence[MangaService], *, cur: CursorType = NotImplemented
    ) -> list[MangaServiceWithId]:
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

        return list(MangaServiceWithId.from_manga_services(exists))

    @OptionalTransaction()
    def add_new_manga[TManga: Manga](
        self, manga: TManga, *, cur: CursorType = NotImplemented
    ) -> TManga:
        """
        Adds a single manga to the database without any checks.
        Wrapper for add_new_mangas that works with single objects instead of lists.
        """
        return self.add_new_mangas([manga], cur=cur)[0]

    @OptionalTransaction()
    def add_new_mangas(
        self, mangas: Collection[MangaModel], *, cur: CursorType = NotImplemented
    ) -> list[MangaModel]:
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

        args = [
            (
                manga.title,
                manga.release_interval,
                manga.latest_release,
                manga.estimated_release,
                manga.latest_chapter,
                manga.views,
            )
            for manga in mangas
        ]

        # Assume that RETURNING returns records in order
        sql = (
            'INSERT INTO manga '
            '(title, release_interval, latest_release, estimated_release, latest_chapter, views) '
            'VALUES %s RETURNING title, manga_id'
        )
        rows = execute_values(cur, sql, args, page_size=len(args), fetch=True)

        try:
            elastic_data = []
            for row, manga in zip(rows, mangas, strict=True):
                if row['title'] != manga.title:
                    logger.warning(f'Inserted manga mismatch with {manga}')
                    continue

                manga.manga_id = row['manga_id']
                elastic_data.append({
                    '_id': row['manga_id'],
                    'manga_id': row['manga_id'],
                    'title': row['title'],
                    'views': 0,
                    'aliases': [],
                    'services': [],
                })

            logger.debug('Inserting new manga to elasticsearch. %s', elastic_data)
            self.es.bulk_upsert(elastic_data, 'create')
        except Exception:
            logger.exception('Failed to add new manga to elasticsearch')

        return list(mangas)

    @OptionalTransaction()
    def add_manga_service[MangaServiceBound: MangaService](
        self, manga: MangaServiceBound, *, add_manga: bool = False, cur: CursorType = NotImplemented
    ) -> MangaServiceBound:
        """
        Adds the given manga service object to the database.
        If add_manga is set to True will call add_new_manga first
        """
        if add_manga:
            self.add_new_manga(manga)

        return self.add_manga_services([manga], cur=cur)[0]

    @OptionalTransaction()
    def add_manga_services(
        self, mangas: Collection[MangaServiceBound], *, cur: CursorType = NotImplemented
    ) -> list[MangaServiceBound]:
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
                m.feed_url,
            )
            for m in mangas
        ]
        sql = (
            'INSERT INTO manga_service '
            '(manga_id, service_id, disabled, last_check, title_id, next_update, latest_chapter, latest_decimal, feed_url)  '
            'VALUES %s RETURNING manga_id, title_id'
        )

        rows = execute_values(cur, sql, args, page_size=len(args), fetch=True)

        for row, manga in zip(rows, mangas, strict=True):
            if row['title_id'] != manga.title_id:
                logger.warning(f'Inserted manga mismatch with {manga}')
                continue

            manga.manga_id = row['manga_id']

        try:
            manga_ids = list({r['manga_id'] for r in rows})

            manga_services = self.get_manga_services(manga_ids)
            elastic_data = []
            m_it: Iterator[MangaServicePartialWithId]
            services: dict[int, Service] = {s.service_id: s for s in self.get_services()}

            for manga_id, m_it in groupby(
                sorted(manga_services, key=lambda r: r.manga_id), key=lambda r: r.manga_id
            ):
                elastic_data.append({
                    '_id': manga_id,
                    'services': [
                        {
                            'service_id': service.service_id,
                            'service_name': services[service.service_id].service_name,
                        }
                        for service in m_it
                    ],
                })

            logger.debug('Inserting new manga services to elasticsearch. %s', elastic_data)
            self.es.bulk_upsert(elastic_data)
        except Exception:
            logger.exception('Failed to add manga services to elasticsearch')

        return list(mangas)

    @OptionalTransaction()
    def get_service_whole(
        self, service_id: int, *, cur: CursorType = NotImplemented
    ) -> ServiceWhole | None:
        cur.execute('SELECT * FROM service_whole WHERE service_id=%s', [service_id])
        row = cur.fetchone()

        return ServiceWhole.model_validate(row) if row else None

    @OptionalTransaction()
    def get_service_configs(self, *, cur: CursorType = NotImplemented) -> list[ServiceConfig]:
        cur.execute('SELECT * FROM service_config')

        return list(map(ServiceConfig.model_validate, cur))

    @OptionalTransaction()
    def get_services(self, *, cur: CursorType = NotImplemented) -> list[Service]:
        cur.execute('SELECT * FROM services')

        return list(map(Service.model_validate, cur))

    @OptionalTransaction()
    def update_service_whole(
        self, service_id: int, update_interval: timedelta, *, cur: CursorType = NotImplemented
    ) -> None:
        now = utcnow()
        cur.execute('UPDATE services SET last_check=%s WHERE service_id=%s', [now, service_id])

        cur.execute(
            'UPDATE service_whole SET last_check=%s, next_update=%s WHERE service_id=%s',
            [now, now + update_interval, service_id],
        )

    @optional_generator_transaction
    def find_added_titles(
        self, service_id: int, title_ids: Collection[str], *, cur: CursorType = NotImplemented
    ) -> Generator[MangaServicePartial]:
        """Find manga_service rows with an existing title_id"""
        if len(title_ids) == 0:
            return None

        format_ids = self.get_format_args(title_ids)
        sql = f'SELECT * FROM manga_service WHERE service_id=%s AND title_id IN ({format_ids})'
        cur.execute(sql, [service_id, *title_ids])
        for row in cur:
            yield MangaServicePartial(**row)

    @OptionalTransaction()
    def find_service_manga(
        self, service_id: int, title_id: str, *, cur: CursorType = NotImplemented
    ) -> DictRow | None:
        sql: LiteralString = 'SELECT * FROM manga_service WHERE service_id=%s AND title_id=%s'
        cur.execute(sql, (service_id, title_id))
        return cur.fetchone()

    @OptionalTransaction(class_row(MangaServiceWithId))
    def get_manga_service(
        self, service_id: int, title_id: str, *, cur: Cursor[MangaServiceWithId] = NotImplemented
    ) -> MangaServiceWithId | None:
        sql = """
            SELECT * FROM manga_service ms
            INNER JOIN manga m ON ms.manga_id = m.manga_id
            WHERE service_id = %s AND ms.title_id = %s
        """

        cur.execute(sql, (service_id, title_id))
        return cur.fetchone()

    @OptionalTransaction()
    def get_manga_services(
        self, manga_ids: Sequence[int], *, cur: CursorType = NotImplemented
    ) -> list[MangaServicePartialWithId]:
        if not manga_ids:
            return []

        sql = (
            f'SELECT * FROM manga_service ms WHERE manga_id IN ({self.get_format_args(manga_ids)})'
        )

        cur.execute(sql, manga_ids)
        return [MangaServicePartialWithId.model_validate(row) for row in cur]

    @OptionalTransaction()
    def get_manga(self, manga_id: int, *, cur: CursorType = NotImplemented) -> Manga | None:
        """
        Get manga object from database
        """
        cur.execute('SELECT * FROM manga WHERE manga_id=%s', (manga_id,))
        row = cur.fetchone()
        return Manga(**row) if row else None

    @OptionalTransaction()
    def get_mangas_for_notifications(
        self, manga_ids: list[int], *, cur: CursorType = NotImplemented
    ) -> list[MangaForNotifications]:
        """
        Get manga object from database
        """
        sql: LiteralString = """
            SELECT m.manga_id, m.title, mi.cover, ms.service_id, ms.title_id
            FROM manga m
              LEFT JOIN manga_info mi ON m.manga_id = mi.manga_id
              INNER JOIN manga_service ms ON m.manga_id = ms.manga_id
            WHERE m.manga_id = ANY(%s)
        """
        cur.execute(sql, (manga_ids,))
        return list(map(MangaForNotifications.model_validate, cur))

    @OptionalTransaction()
    def update_latest_release(
        self, manga_ids: list[int], *, cur: CursorType = NotImplemented
    ) -> None:
        format_ids = self.get_format_args(manga_ids)
        sql = (
            'UPDATE manga m SET latest_release=c.release_date FROM '
            f'(SELECT MAX(release_date), manga_id FROM chapters WHERE manga_id IN ({format_ids}) GROUP BY manga_id) as c(release_date, manga_id)'
            'WHERE m.manga_id=c.manga_id'
        )
        cur.execute(sql, manga_ids)

    @overload
    def add_chapters(
        self,
        chapters: Sequence[BaseChapter],
        manga_id: int,
        service_id: int,
        *,
        fetch: bool = True,
        cur: CursorType = NotImplemented,
    ) -> list[InsertedChapter]: ...

    @overload
    def add_chapters(
        self, chapters: Sequence[Chapter], *, fetch: bool = True, cur: CursorType = NotImplemented
    ) -> list[InsertedChapter]: ...

    @OptionalTransaction()
    def add_chapters(
        self,
        chapters: Sequence[Chapter] | Sequence[BaseChapter],
        manga_id: int | None = None,
        service_id: int | None = None,
        *,
        fetch: bool = True,
        cur: CursorType = NotImplemented,
    ) -> list[InsertedChapter]:
        if not chapters:
            return []

        data: list[tuple]
        if isinstance(chapters[0], Chapter):
            chapters = cast(Sequence[Chapter], chapters)
            data = [
                (
                    c.manga_id,
                    c.service_id,
                    c.title,
                    c.chapter_number,
                    c.chapter_decimal,
                    c.chapter_identifier,
                    c.release_date,
                    c.group_id,
                )
                for c in chapters
            ]
        else:
            chapters = cast(Sequence[BaseChapter], chapters)
            data = [
                (
                    manga_id,
                    service_id,
                    chapter.title,
                    chapter.chapter_number,
                    chapter.decimal,
                    chapter.chapter_identifier,
                    chapter.release_date,
                    chapter.group_id,
                )
                for chapter in chapters
            ]

        sql = (
            'INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_decimal, chapter_identifier, release_date, group_id) '
            'VALUES %s ON CONFLICT DO NOTHING'
        )
        if fetch:
            sql += ' RETURNING chapter_id, manga_id, chapter_number, chapter_decimal, release_date, chapter_identifier'

        retval = execute_values(cur, sql, data, page_size=max(len(data), 300), fetch=fetch)
        if not retval:
            return []

        return list(map(InsertedChapter.model_validate, retval))

    @OptionalTransaction()
    def update_latest_chapter(
        self, data: Collection[tuple[int, int, datetime]], *, cur: CursorType = NotImplemented
    ) -> None:
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
        rows = {r['manga_id']: r['latest_chapter'] for r in rows}
        data = [d for d in data if rows[d[0]] is None or rows[d[0]] < d[1]]
        if not data:
            return

        sql = (
            'UPDATE manga m SET latest_chapter=c.latest_chapter, estimated_release=c.release_date + release_interval FROM '
            ' (VALUES %s) AS c(manga_id, latest_chapter, release_date) '
            'WHERE c.manga_id=m.manga_id'
        )
        execute_values(cur, sql, data)

    @OptionalTransaction()
    def update_estimated_release(
        self, manga_id: int, *, cur: CursorType = NotImplemented
    ) -> DictRow | None:
        sql = """
            WITH tmp AS (
                SELECT MAX(chapter_number) AS chn FROM chapters WHERE manga_id = %(manga)s
            )
            UPDATE manga
            SET estimated_release=release_interval + (
                SELECT MIN(release_date)
                FROM chapters
                WHERE manga_id = %(manga)s
                    AND chapter_number = (SELECT chn FROM tmp)
                    AND chapter_decimal IS NOT DISTINCT FROM (
                        SELECT MAX(chapter_decimal)
                        FROM chapters
                        WHERE manga_id = %(manga)s
                            AND chapter_number = (SELECT chn FROM tmp)
                    )
                )
            WHERE manga_id = %(manga)s
            AND release_interval IS NOT NULL
            RETURNING estimated_release, (SELECT estimated_release FROM manga WHERE manga_id = %(manga)s) AS estimated_release_old
        """

        cur.execute(sql, {'manga': manga_id})
        rows = cur.fetchall()
        if not rows:
            maintenance.warning(
                "Nothing updated because manga id doesn't exist or release_interval was NULL"
            )
            return None

        row = rows[0]
        maintenance.info(
            f'Set estimated release from {row["estimated_release_old"]} to {row["estimated_release"]}'
        )
        return row

    @OptionalTransaction()
    def update_chapter_titles(
        self, service_id: int, chapters: Iterable[BaseChapter], *, cur: CursorType = NotImplemented
    ) -> None:
        service_id = int(service_id)

        sql = f"""
        UPDATE chapters
        SET title=c.title
        FROM (VALUES %s) AS c(title, id)
        WHERE service_id={service_id} AND chapter_identifier=c.id
        """

        execute_values(cur, sql, [(c.title, c.chapter_identifier) for c in chapters], page_size=200)

    @OptionalTransaction()
    def get_only_latest_entries(
        self,
        service_id: int,
        entries: Collection[BaseChapter],
        manga_id: int | None = None,
        *,
        cur: CursorType = NotImplemented,
    ) -> Collection[BaseChapter]:
        if not entries:
            return []

        if len(entries) > 500:
            logger.warning('Over 500 entries passed to get_only_latest_entries for service %', service_id)

        args: tuple = tuple(c.chapter_identifier for c in entries)
        format_args = ','.join(('%s',) * len(args))

        if manga_id:
            sql = (
                'SELECT chapter_identifier FROM chapters '
                f'WHERE service_id=%s AND manga_id=%s AND chapter_identifier IN ({format_args})'
            )
            args = (service_id, manga_id, *args)
        else:
            sql = (
                'SELECT chapter_identifier FROM chapters '
                f'WHERE service_id=%s AND chapter_identifier IN ({format_args})'
            )
            args = (service_id, *args)

        try:
            cur.execute(sql, args)

            return set(entries).difference(set(r['chapter_identifier'] for r in cur))

        except Exception:
            logger.exception('Failed to get old chapters')
            return list(entries)

    @OptionalTransaction()
    def set_manga_last_checked(
        self,
        service_id: int,
        manga_id: int,
        last_checked: datetime | None,
        *,
        cur: CursorType = NotImplemented,
    ) -> None:
        sql: LiteralString = (
            'UPDATE manga_service SET last_check=%s WHERE manga_id=%s AND service_id=%s'
        )
        cur.execute(sql, [last_checked, manga_id, service_id])

    @OptionalTransaction(class_row(Group))
    def find_existing_groups(
        self, group_names: list[str], *, cur: Cursor[Group] = NotImplemented
    ) -> list[Group]:
        if not group_names:
            return []

        format_args = self.get_format_args(group_names)
        sql = f'SELECT * FROM groups WHERE name IN ({format_args})'
        cur.execute(sql, group_names)
        return cur.fetchall()

    @OptionalTransaction()
    def update_group_mangadex_ids(
        self, groups: Iterable[Group], *, cur: CursorType = NotImplemented
    ) -> None:
        sql = (
            'UPDATE groups g SET mangadex_id=v.mangadex_id::uuid '
            'FROM (VALUES %s) AS v(mangadex_id, group_id) '
            'WHERE g.group_id = v.group_id'
        )

        execute_values(cur, sql, [(g.mangadex_id, g.group_id) for g in groups], page_size=200)

    @OptionalTransaction()
    def get_or_create_group(self, group_name: str, *, cur: CursorType = NotImplemented) -> Group:
        groups = list(self.find_existing_groups([group_name], cur=cast(Cursor[Any], cur)))
        if not groups:
            groups = list(self.add_new_groups([GroupPartial(name=group_name)], cur=cur))

        return groups[0]

    @OptionalTransaction()
    def add_new_groups(
        self, groups: Collection[GroupPartial], *, cur: CursorType = NotImplemented
    ) -> Iterable[Group]:
        sql = 'INSERT INTO groups (name, mangadex_id) VALUES %s ON CONFLICT DO NOTHING RETURNING *'

        return map(
            Group.model_validate,
            execute_values(
                cur,
                sql,
                [(g.name, g.mangadex_id) for g in groups],
                page_size=len(groups),
                fetch=True,
            ),
        )

    @OptionalTransaction()
    def get_manga_ids_without_artist(
        self, manga_ids: set[int], *, cur: CursorType = NotImplemented
    ) -> set[int]:
        """
        Returns the manga ids that do not have an artist assigned to them
        """
        if not manga_ids:
            return set()

        format_args = self.get_format_args(manga_ids)
        sql = f'SELECT manga_id FROM manga_artists WHERE manga_id IN ({format_args})'
        cur.execute(sql, list(manga_ids))
        return manga_ids.difference([row['manga_id'] for row in cur])

    @OptionalTransaction()
    def get_manga_ids_without_author(
        self, manga_ids: set[int], *, cur: CursorType = NotImplemented
    ) -> set[int]:
        """
        Returns the manga ids that do not have an author assigned to them
        """
        if not manga_ids:
            return set()

        format_args = self.get_format_args(manga_ids)
        sql = f'SELECT manga_id FROM manga_authors WHERE manga_id IN ({format_args})'
        cur.execute(sql, list(manga_ids))
        return manga_ids.difference([row['manga_id'] for row in cur])

    @OptionalTransaction()
    def get_author_by_name(self, name: str, *, cur: CursorType = NotImplemented) -> Author | None:
        sql = 'SELECT * FROM authors WHERE name=%s LIMIT 1'
        cur.execute(sql, (name,))

        row = cur.fetchone()
        if row is None:
            return None

        return Author(**row)

    @OptionalTransaction()
    def manga_has_author(self, manga_id: int, *, cur: Cursor[DictRow] = NotImplemented) -> bool:
        sql: LiteralString = (
            'SELECT EXISTS(SELECT 1 FROM manga_authors WHERE manga_id=%s) AS "exists"'
        )
        cur.execute(sql, (manga_id,))
        return cast(DictRow, cur.fetchone())['exists']

    @OptionalTransaction()
    def manga_has_artist(self, manga_id: int, *, cur: Cursor[DictRow] = NotImplemented) -> bool:
        sql: LiteralString = (
            'SELECT EXISTS(SELECT 1 FROM manga_artists WHERE manga_id=%s) AS "exists"'
        )
        cur.execute(sql, (manga_id,))
        return cast(DictRow, cur.fetchone())['exists']

    @OptionalTransaction()
    def add_author_with_duplicate_check(
        self, author: AuthorPartial, *, cur: CursorType = NotImplemented
    ) -> Author:
        found_author = self.get_author_by_name(author.name, cur=cur)
        if found_author:
            return found_author

        return next(iter(self.add_authors([author], cur=cur)))

    def add_manga_author_artist_if_not_exist(
        self,
        manga_id: int,
        author: AuthorPartial,
        artist: AuthorPartial | None,
        *,
        cur: CursorType = NotImplemented,
    ) -> None:
        """
        Adds the given author and artist to the manga if that manga does not already have them assigned.
        Adds the authors to the database if their name is not in it yet
        """
        if not self.manga_has_author(manga_id, cur=cur):
            found_author = self.add_author_with_duplicate_check(author, cur=cur)
            manga_author = MangaAuthor(manga_id=manga_id, author_id=found_author.author_id)
            self.add_manga_authors([manga_author], cur=cur)

        # Only add artist if the name differs from the author
        if artist and artist.name != author.name and not self.manga_has_artist(manga_id, cur=cur):
            found_author = self.add_author_with_duplicate_check(artist, cur=cur)
            manga_artist = MangaArtist(manga_id=manga_id, author_id=found_author.author_id)
            self.add_manga_artists([manga_artist], cur=cur)

    @OptionalTransaction()
    def add_authors(
        self, authors: Collection[AuthorPartial], *, cur: CursorType = NotImplemented
    ) -> Iterable[Author]:
        if not authors:
            return []

        sql = 'INSERT INTO authors (name, mangadex_id) VALUES %s RETURNING *'
        return map(
            Author.model_validate,
            execute_values(cur, sql, [(a.name, a.mangadex_id) for a in authors], fetch=True),
        )

    @OptionalTransaction()
    def add_manga_artists(
        self, manga_artist: Collection[MangaArtist], *, cur: CursorType = NotImplemented
    ) -> None:
        if not manga_artist:
            return None

        sql = 'INSERT INTO manga_artists (manga_id, author_id) VALUES %s'
        execute_values(cur, sql, [(ma.manga_id, ma.author_id) for ma in manga_artist])
        return None

    @OptionalTransaction()
    def add_manga_authors(
        self, manga_author: Collection[MangaAuthor], *, cur: CursorType = NotImplemented
    ) -> None:
        if not manga_author:
            return None

        sql = 'INSERT INTO manga_authors (manga_id, author_id) VALUES %s'
        execute_values(cur, sql, [(ma.manga_id, ma.author_id) for ma in manga_author])

    @OptionalTransaction(class_row(MangaAuthor))
    def get_manga_authors(
        self, manga_id: int, *, cur: Cursor[MangaAuthor] = NotImplemented
    ) -> list[MangaAuthor]:
        sql = 'SELECT * FROM manga_authors WHERE manga_id=%s'
        cur.execute(sql, (manga_id,))
        return cur.fetchall()

    @OptionalTransaction(class_row(MangaArtist))
    def get_manga_artists(
        self, manga_id: int, *, cur: Cursor[MangaArtist] = NotImplemented
    ) -> list[MangaArtist]:
        sql = 'SELECT * FROM manga_artists WHERE manga_id=%s'
        cur.execute(sql, (manga_id,))
        return cur.fetchall()

    @OptionalTransaction(class_row(Author))
    def find_existing_mangadex_authors(
        self, mangadex_ids: list[str], *, cur: Cursor[Author] = NotImplemented
    ) -> list[Author]:
        if not mangadex_ids:
            return []

        format_args = self.get_format_args(mangadex_ids)
        sql = f'SELECT * FROM authors WHERE mangadex_id IN ({format_args})'
        cur.execute(sql, mangadex_ids)
        return cur.fetchall()

    @OptionalTransaction()
    def update_manga_infos(
        self,
        manga_infos: Collection[MangaInfo],
        *,
        update_last_check: bool = True,
        cur: CursorType = NotImplemented,
    ) -> None:
        if not manga_infos:
            return

        data = [
            (
                mi.manga_id,
                mi.cover,
                mi.bw,
                mi.mu,
                mi.mal,
                mi.amz,
                mi.ebj,
                mi.engtl,
                mi.raw,
                mi.nu,
                mi.kt,
                mi.ap,
                mi.al,
            )
            for mi in manga_infos
        ]
        sql = f"""
            INSERT INTO manga_info as mi (manga_id, cover, bw, mu, mal, amz, ebj, engtl, raw, nu, kt, ap, al)
            VALUES %s
            ON CONFLICT (manga_id) DO UPDATE SET
                cover=COALESCE(excluded.cover, mi.cover),
                bw=COALESCE(excluded.bw, mi.bw),
                mu=COALESCE(excluded.mu, mi.mu),
                mal=COALESCE(excluded.mal, mi.mal),
                amz=COALESCE(excluded.amz, mi.amz),
                ebj=COALESCE(excluded.ebj, mi.ebj),
                engtl=COALESCE(excluded.engtl, mi.engtl),
                raw=COALESCE(excluded.raw, mi.raw),
                nu=COALESCE(excluded.nu, mi.nu),
                kt=COALESCE(excluded.kt, mi.kt),
                ap=COALESCE(excluded.ap, mi.ap),
                al=COALESCE(excluded.al, mi.al)
                {',last_updated=CURRENT_TIMESTAMP' if update_last_check else ''}
        """
        execute_values(cur, sql, data)

    @OptionalTransaction()
    def update_manga_titles(
        self, titles: list[tuple[int, str]], *, cur: CursorType = NotImplemented
    ) -> None:
        """
        Update manga titles with new ones with the given (title, id) list
        """
        if not titles:
            return

        sql = """
            -- Select manga with new titles
            WITH to_update AS (
                SELECT v.title, v.manga_id FROM (VALUES %s) AS v(manga_id, title)
                INNER JOIN manga m
                    ON m.manga_id = v.manga_id AND LOWER(m.title) != LOWER(v.title)
            ),
            -- Update said manga and return their old titles
            updated AS (
                UPDATE manga m SET title = tu.title
                FROM to_update tu, manga old
                WHERE tu.manga_id = m.manga_id AND m.manga_id = old.manga_id
                RETURNING m.manga_id, old.title
            )
            -- Add the old titles as aliases
            INSERT INTO manga_alias AS ma (manga_id, title)
            SELECT manga_id, title FROM updated
            ON CONFLICT DO NOTHING
        """

        execute_values(cur, sql, titles)

        try:
            manga_ids = list({v[0] for v in titles})

            sql = f"""
                SELECT m.manga_id as _id, m.manga_id, m.title, array_remove(array_agg(ma.title), NULL) as aliases
                FROM manga m
                LEFT JOIN manga_alias ma ON m.manga_id = ma.manga_id
                WHERE m.manga_id IN ({self.get_format_args(manga_ids)})
                GROUP BY m.manga_id
            """

            cur.execute(sql, manga_ids)
            rows = cur.fetchall()

            logger.debug('Updating elasticsearch titles for %s', manga_ids)

            self.es.bulk_upsert({**row} for row in self.es.format_aliases(rows))
        except Exception:
            logger.exception('Failed to update elasticsearch aliases')

    @OptionalTransaction()
    def find_manga_by_title(self, title: str, *, cur: CursorType = NotImplemented) -> Manga | None:
        sql = 'SELECT * FROM manga WHERE title=%s LIMIT 1'
        cur.execute(sql, (title,))
        row = cur.fetchone()
        return None if not row else Manga(**row)

    @OptionalTransaction()
    def get_notifications_by_manga_ids(
        self, manga_ids: list[int], *, cur: CursorType = NotImplemented
    ) -> list[PartialNotificationInfo]:
        sql = """
            SELECT un.notification_id, manga_id, service_id
            FROM user_notifications un
              INNER JOIN notification_manga nm ON un.notification_id = nm.notification_id
            WHERE NOT un.disabled
              AND NOT use_follows
              AND manga_id = ANY(%(manga_ids)s)
            UNION
            SELECT notification_id, uf.manga_id, uf.service_id
            FROM user_notifications un
               INNER JOIN user_follows uf ON un.user_id = uf.user_id
            WHERE NOT un.disabled
              AND un.use_follows
              AND manga_id = ANY(%(manga_ids)s)
        """

        cur.execute(sql, {'manga_ids': manga_ids})
        return list(map(PartialNotificationInfo.model_validate, cur))

    @OptionalTransaction(class_row(UserNotification))
    def get_notification_info(
        self, notification_id: int, *, cur: Cursor[UserNotification] = NotImplemented
    ) -> UserNotification:
        sql = (
            'SELECT * FROM user_notifications un '
            'INNER JOIN notification_options no ON un.notification_id = no.notification_id '
            'WHERE un.notification_id=%s'
        )
        cur.execute(sql, (notification_id,))
        return self.fetchone_or_throw(cur)

    @OptionalTransaction(class_row(InputField))
    def get_notification_inputs(
        self, notification_id: int, *, cur: Cursor[InputField] = NotImplemented
    ) -> list[InputField]:
        sql = (
            'SELECT unf.value, nf.name, nf.optional, unf.override_id FROM user_notification_fields unf '
            'INNER JOIN notification_fields nf ON nf.field_id=unf.field_id '
            'WHERE notification_id=%s'
        )
        cur.execute(sql, (notification_id,))
        return cur.fetchall()

    @OptionalTransaction()
    def update_notification_stats(
        self, notification_id: int, runs: int, failed: int, *, cur: CursorType = NotImplemented
    ) -> None:
        sql = """
            UPDATE user_notifications
            SET times_run=times_run + %(runs)s,
                times_failed=times_failed + %(failed)s,
                failed_in_row=CASE
                    WHEN %(failed)s = 0 THEN 0
                    ELSE failed_in_row + %(failed)s
                END
            WHERE notification_id = %(notification_id)s
        """
        cur.execute(sql, {'runs': runs, 'failed': failed, 'notification_id': notification_id})

    @OptionalTransaction()
    def disable_manga_service(
        self, service_id: int, title_id: str, *, cur: CursorType = NotImplemented
    ) -> None:
        sql = 'UPDATE manga_service SET disabled=TRUE WHERE service_id=%s AND title_id=%s'
        cur.execute(sql, (service_id, title_id))
