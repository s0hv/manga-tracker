import collections
import os
import subprocess
import sys
import typing
import unittest
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any, Iterable, TypeVar, Union, override
from unittest import mock

import feedparser
import psycopg
import pytest
import testing.postgresql
from psycopg import Connection
from psycopg.rows import DictRow, dict_row
from pydantic import BaseModel

from elasticsearch.client import Elasticsearch
from src.constants import NO_GROUP
from src.db.models.chapter import Chapter as DbChapter
from src.db.models.manga import Manga, MangaService, MangaServiceWithId
from src.scheduler import LoggingCursor
from src.scrapers.base_scraper import BaseChapter, BaseChapterSimple, BaseScraper
from src.tests.scrapers.testing_scraper import DummyScraper
from src.utils.dbutils import DbUtil
from src.utils.utilities import FeedType, utcnow

originalParse = feedparser.parse

DONT_USE_TEMP_DATABASE = bool(os.environ.get('NO_TEMP_DB', False))

Postgresql: testing.postgresql.PostgresqlFactory | None = None

EMPTY_SCRAPE_SERVICE: tuple[list, list] = ([], [])
TEST_USER_ID = 3

if DONT_USE_TEMP_DATABASE:
    Postgresql = None
else:
    Postgresql = testing.postgresql.PostgresqlFactory(
        cache_initialized_db=True,
        initdb_args='-E=UTF8 -U postgres -A trust'
    )

T = TypeVar('T')


def run_migrations(conn: Connection[DictRow]) -> None:
    filepath = os.path.dirname(__file__)
    root = os.path.join(filepath, '..', '..')
    env = os.environ.copy()
    env['DB_USER'] = conn.info.user
    env['PGPASSWORD'] = conn.info.password
    env['DB_HOST'] = conn.info.host
    env['DB_NAME'] = conn.info.dbname
    env['DB_PORT'] = str(conn.info.port)

    if extra_path := os.environ.get('EXTRA_TEST_PATH'):
        env['PATH'] = f"{extra_path};{env.get('PATH', '')}"

    cmd = 'pnpm migrate:up && pnpm migrate:test'
    p = subprocess.Popen(cmd, env=env, cwd=root, shell=True,
                         stdout=sys.stdout if DONT_USE_TEMP_DATABASE else subprocess.DEVNULL)
    p.wait()


def create_db(postgres: testing.postgresql.Postgresql | None) -> Connection[DictRow]:
    conn = create_conn(postgres)
    run_migrations(conn)
    return conn


def create_conn(postgres: testing.postgresql.Postgresql | None) -> Connection[DictRow]:
    conn: Connection[DictRow]
    if DONT_USE_TEMP_DATABASE or not postgres:
        conn = psycopg.connect(
            host=os.environ['DB_HOST'],
            port=os.environ['DB_PORT'],
            dbname=os.environ['DB_NAME'],
            user=os.environ['DB_USER'],
            password=os.environ['PGPASSWORD'],
            row_factory=dict_row
        )
    else:
        conn = psycopg.connect(postgres.url(), row_factory=dict_row)

    conn.cursor_factory = LoggingCursor
    return conn


def start_db() -> None:
    if Postgresql:
        Postgresql.cache.start()


def get_conn() -> Connection[DictRow]:
    conn = create_conn(None if not Postgresql else Postgresql.cache)
    return conn


def teardown_db() -> None:
    if not Postgresql:
        return None

    try:
        Postgresql.cache.stop()
    finally:
        Postgresql.clear_cache()


def mock_feedparse[**P](feed: object, *args: P.args, **kwargs: P.kwargs) -> Callable[P, FeedType]:
    def wrapper(*_, **__) -> FeedType:
        return originalParse(feed, *args, **kwargs)

    return wrapper


# Actually returns a literal union between the input and MagicMock
def spy_on(instance: T) -> T | mock.MagicMock:
    return mock.MagicMock(spec_set=instance, wraps=instance)


def set_db_environ():
    """
    Sets environment variables to match the created temporary database.
    """
    os.environ['ELASTIC_NODE'] = f"{os.getenv('ELASTIC_TEST_HOST', 'localhost')}:{os.getenv('ELASTIC_TEST_PORT', 9200)}"

    if DONT_USE_TEMP_DATABASE:
        return

    assert Postgresql is not None
    conf = Postgresql.cache.dsn()
    os.environ['DB_HOST'] = conf['host']
    os.environ['DB_NAME'] = conf.get('database', conf.get('dbname'))
    os.environ["DB_USER"] = conf["user"]
    os.environ["DB_PASSWORD"] = ""
    os.environ["DB_PORT"] = str(conf["port"])


def assert_count_equals(first: Iterable, second: Iterable) -> None:
    first_counter = collections.Counter(list(first))
    second_counter = collections.Counter(list(second))

    assert first_counter == second_counter


class BaseTestClasses:
    class TitleIdGenerator:
        def __init__(self):
            self._id = 0

        def generate(self, name: str) -> str:
            self._id += 1
            return f'{name}_{self._id}'

    class DatabaseTestCase(unittest.TestCase):
        _conn: Connection[DictRow] = NotImplemented
        _generator: 'BaseTestClasses.TitleIdGenerator' = NotImplemented

        @pytest.fixture(autouse=True, scope='class')
        def _setup_class(self, request: pytest.FixtureRequest, conn: Connection[DictRow]) -> None:
            request.cls._conn = conn
            # Integers are retained during tests but they reset to the default value
            # for some reason. Circumvent this by using a class.
            request.cls._generator = BaseTestClasses.TitleIdGenerator()

            request.addfinalizer(self._teardown_class)  # noqa: PT021

        @property
        def conn(self) -> Connection[DictRow]:
            return self._conn

        @pytest.fixture(autouse=True)
        def _get_elasticsearch(self, es: Elasticsearch):
            self.elasticsearch = es

        @pytest.fixture(autouse=True)
        def _set_up_dbutil(self, dbutil: DbUtil):
            self.dbutil = dbutil

        def _teardown_class(self) -> None:
            self._conn.close()

        def get_str_id(self) -> str:
            return self._generator.generate(type(self).__name__)

        def get_manga_service(self, scraper: type['BaseScraper'] = DummyScraper) -> MangaService:
            id_ = self.get_str_id()
            return MangaService(service_id=scraper.ID, title_id=id_,
                                title=f'{id_}_manga')

        def create_manga_service(self, scraper: type['BaseScraper'] = DummyScraper) -> MangaServiceWithId:
            id_ = self.get_str_id()
            ms = MangaServiceWithId(service_id=scraper.ID, title_id=id_,
                                    title=f'{id_}_manga', manga_id=0)
            return self.dbutil.add_manga_service(ms, add_manga=True)

        def create_db_chapter_objects(self, manga: MangaService, n: int) -> list['DbChapter']:
            return [
                DbChapter(
                    manga_id=manga.manga_id, service_id=manga.service_id,
                    title=f'chapter_{id_}', chapter_number=1,
                    chapter_identifier=id_,
                    release_date=self.utcnow(),
                    group_id=NO_GROUP)
                for id_ in [self.get_str_id() for _ in range(n)]]

        def create_chapters(self, manga: MangaService, n: int) -> list[DbChapter]:
            chapters = self.create_db_chapter_objects(manga, n)
            inserted = {c.chapter_identifier: c.chapter_id for c in self.dbutil.add_chapters(chapters)}
            for c in chapters:
                c.chapter_id = inserted[c.chapter_identifier]

            return chapters

        def delete_chapters(self, service_id: int):
            self.dbutil.execute('DELETE FROM chapters WHERE service_id=%s',
                                (service_id,))

        # region DbUtil wrappers

        def get_manga_db(self, manga_id: int | None) -> Manga:
            manga = self.dbutil.get_manga(manga_id or -1)
            assert manga is not None
            return manga

        # endregion

        def assertChapterEqualsRow(self, chapter: 'Chapter', row: DictRow) -> None:
            pairs: list[tuple[str, str] | tuple[str, str, Any]] = [
                ('chapter_title', 'title'),
                ('chapter_number', 'chapter_number'),
                ('decimal', 'chapter_decimal'),
                ('release_date', 'release_date',
                 lambda: (chapter.release_date, row['release_date'])
                 ),
                ('chapter_identifier', 'chapter_identifier'),
                ('group', 'group')
            ]

            for val in pairs:
                chapter_attr: str
                row_attr: str
                chapter_attr, row_attr = val[:2]
                if len(val) == 3:
                    get_vals = val[2]
                else:
                    def get_vals() -> tuple[Any, Any]:
                        return getattr(chapter, chapter_attr), row[row_attr]  # noqa: B023 Function is only used once in the same loop

                c_val, r_val = get_vals()
                if c_val != r_val:
                    self.fail(
                        'Chapter from database does not equal model\n'
                        f'{chapter_attr} != {row_attr}\n'
                        f'{c_val} != {row[row_attr]}'
                    )

        def assertDatesEqual(self, date1: datetime | None, date2: datetime | None):
            if date1 != date2:
                self.fail(f'Date {date1} does not match date {date2}')

        def assertDatesNotEqual(self, date1: datetime | None, date2: datetime):
            if date1 == date2:
                self.fail(f'Date {date1} equals date {date2}')

        def assertDateGreater(self, date1: datetime | None, date2: datetime):
            assert date1 is not None
            if date1 <= date2:
                self.fail(f'Date {date1} is earlier or equal to {date2}')

        def assertDateLess(self, date1: datetime | None, date2: datetime):
            assert date1 is not None
            if date1 >= date2:
                self.fail(f'Date {date1} is later or equal to {date2}')

        def assertDatesAlmostEqual(self, date1: datetime | None, date2: datetime,
                                   delta: timedelta = timedelta(seconds=1),
                                   msg: str | None = None):
            assert date1 is not None
            if date1 == date2:
                return

            assert abs(date1 - date2) <= delta, msg

        def assertMangaServiceExists(self, title_id: str, service_id: int):
            sql = 'SELECT 1 FROM manga_service WHERE service_id=%s AND title_id=%s'
            with self.conn.cursor() as cur:
                cur.execute(sql, (service_id, title_id))
                row = cur.fetchone()

            assert row is not None, f'Manga {title_id} not found'

        def assertMangaWithTitleFound(self, title: str):
            assert self.dbutil.find_manga_by_title(title) is not None, f'Manga with title {title} not found when expected to be found'

        @staticmethod
        def utcnow() -> datetime:
            """
            Return utc time
            """
            return utcnow()

        @staticmethod
        def dbChapterSortKey(chapter: 'DbChapter') -> str:
            return chapter.chapter_identifier

        def assertDbChaptersEqual(self, a: 'DbChapter', expected: 'DbChapter', include_id: bool = False):
            assert a.chapter_number == expected.chapter_number, f'Chapter numbers not equal for {a.chapter_identifier}'
            assert a.chapter_decimal == expected.chapter_decimal, f'Chapter decimal numbers not equal for {a.chapter_identifier}'
            self.assertDatesEqual(a.release_date, expected.release_date)
            assert a.chapter_identifier == expected.chapter_identifier, f'Chapter identifiers not equal for {a.chapter_identifier}'
            assert a.manga_id == expected.manga_id, f'Manga ids not equal for {a.chapter_identifier}'
            assert a.group == expected.group, f'Chapter groups not equal for {a.chapter_identifier}'
            assert a.title == expected.title, f'Chapter titles not equal for {a.chapter_identifier}'
            assert a.group_id == expected.group_id, f'Group ids are not equal for {a.chapter_identifier}'
            assert a.service_id == expected.service_id, f'Service ids not equal for {a.chapter_identifier}'

            if include_id:
                assert a.chapter_id == expected.chapter_id, f'Chapter ids not equal for {a.chapter_identifier}'

        def assertAllDbChaptersEqual(self, chapters: list['DbChapter'], expected: list['DbChapter'],
                                     include_id: bool = False):
            assert len(chapters) == len(expected), 'Different amount of chapters passed'

            for chapter, expect in zip(
                    sorted(chapters, key=self.dbChapterSortKey),
                    sorted(expected, key=self.dbChapterSortKey), strict=True):
                self.assertDbChaptersEqual(chapter, expect, include_id=include_id)

        def _get_manga_service(self, service_id: int, title_id: str) -> MangaService:
            ms = self.dbutil.get_manga_service(service_id, title_id)
            assert ms is not None
            return ms

        def assertMangaServiceEnabled(self, service_id: int, title_id: str):
            assert not self._get_manga_service(service_id, title_id).disabled

        def assertMangaServiceDisabled(self, service_id: int, title_id: str):
            assert self._get_manga_service(service_id, title_id).disabled

    class ModelAssertions(unittest.TestCase):
        def assertChaptersEqual(self, a: Union[BaseChapter, 'ChapterTestModel', DbChapter],
                                b: Union[BaseChapter, 'ChapterTestModel'], ignore_date: bool = False):

            if isinstance(a, DbChapter):
                assert a.chapter_number == b.chapter_number, f'Chapter numbers not equal for {a.chapter_identifier}'
                assert a.chapter_decimal == b.decimal, f'Chapter decimal numbers not equal for {a.chapter_identifier}'

                if not ignore_date:
                    assert a.release_date == b.release_date, f'Chapter release dates not equal for {a.chapter_identifier}'

            else:
                assert a.chapter_title == b.chapter_title, f'Chapter titles not equal for {a.chapter_identifier}'
                assert a.volume == b.volume, f'Chapter volumes not equal for {a.chapter_identifier}'
                assert a.decimal == b.decimal, f'Chapter decimal numbers not equal for {a.chapter_identifier}'
                assert a.title_id == b.title_id, f'Manga title ids not equal for {a.chapter_identifier}'
                assert a.manga_title == b.manga_title, f'Manga titles not equal for {a.chapter_identifier}'
                assert a.manga_url == b.manga_url, f'Manga urls not equal for {a.chapter_identifier}'
                assert a.group == b.group, f'Chapter groups not equal for {a.chapter_identifier}'

                if not ignore_date:
                    assert a.release_date == b.release_date, f'Chapter release dates not equal for {a.chapter_identifier}'

            assert a.chapter_identifier == b.chapter_identifier, f'Chapter identifiers not equal for {a.chapter_identifier}'

            assert a.title == b.title, f'Chapter titles not equal for {a.chapter_identifier}'
            assert a.group_id == b.group_id, f'Group ids are not equal for {a.chapter_identifier}'

        @staticmethod
        def chapterSortKey(chapter: Union[BaseChapter, 'ChapterTestModel', DbChapter]) -> str:
            return chapter.chapter_identifier

        def assertAllChaptersEqual[C: BaseChapter | 'ChapterTestModel'](
                self, chapters: list[C],
                expected: list[BaseChapter] | list['ChapterTestModel'],
                ignore_date: bool = False):
            assert len(chapters) == len(expected), 'Different amount of chapters passed'

            for chapter, expect in zip(sorted(chapters, key=self.chapterSortKey),
                                       sorted(expected, key=self.chapterSortKey), strict=True):
                self.assertChaptersEqual(
                    typing.cast(BaseChapter, chapter),
                    typing.cast(BaseChapter, expect),
                    ignore_date=ignore_date
                )


class Chapter(BaseChapterSimple):
    def __init__(self, chapter_title: str | None = None, chapter_number: int = 0,
                 volume: int | None = None, decimal: int | None = None,
                 release_date: datetime | None = None, chapter_identifier: str = '',
                 title_id: str = '', manga_title: str | None = None,
                 manga_url: str | None = None, group: str | None = None,
                 group_id: int = NO_GROUP):
        super().__init__(
            chapter_title=chapter_title,
            chapter_number=chapter_number,
            chapter_identifier=chapter_identifier,
            title_id=title_id,
            volume=volume,
            decimal=decimal,
            release_date=release_date,
            manga_title=manga_title,
            manga_url=manga_url,
            group=group,
            group_id=group_id
        )

    @override
    @property
    def title(self) -> str:
        return self.chapter_title or 'No title'


class ChapterTestModel(BaseModel):
    chapter_title: str | None = None
    chapter_number: int
    volume: int | None = None
    decimal: int | None = None
    release_date: datetime
    chapter_identifier: str
    title_id: str | None = None
    manga_title: str | None = None
    manga_url: str | None = None
    group: str | None = None
    title: str
    group_id: int

    @classmethod
    def from_chapter(cls, c: BaseChapter) -> 'ChapterTestModel':
        return cls(
            chapter_title=c.chapter_title,
            chapter_number=c.chapter_number,
            volume=c.volume,
            decimal=c.decimal,
            release_date=c.release_date,
            chapter_identifier=c.chapter_identifier,
            title_id=c.title_id,
            manga_title=c.manga_title,
            manga_url=c.manga_url,
            group=c.group,
            title=c.title,
            group_id=c.group_id
        )

    def __lt__(self, other: BaseChapter) -> bool:
        return self.chapter_identifier < other.chapter_identifier

    @override
    def __hash__(self):
        return hash(self.chapter_identifier)

    @override
    def __eq__(self, other: object) -> bool:
        if hasattr(other, 'chapter_identifier'):
            return other.chapter_identifier == self.chapter_identifier
        else:
            return self.chapter_identifier == other


class ChapterSnapshot(BaseModel):
    data: list[ChapterTestModel]


def save_chapters_snapshot(chapters: list[BaseChapter], filename: str):
    chs = list(map(ChapterTestModel.from_chapter, chapters))

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(ChapterSnapshot(data=chs).model_dump_json(indent=2))


def load_chapters_snapshot(filename: str) -> list[ChapterTestModel]:
    with open(filename, encoding='utf-8') as f:
        return ChapterSnapshot.model_validate_json(f.read()).data
