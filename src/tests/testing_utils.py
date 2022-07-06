import json
import os
import subprocess
import sys
import typing
import unittest
from datetime import datetime, timedelta
from typing import TypeVar, Optional, Union, Type, List, Tuple
from unittest import mock

import feedparser
import psycopg2
import pytest
import testing.postgresql  # type: ignore[import]
from psycopg2.extensions import connection as Connection
from psycopg2.extras import DictRow
from pydantic import BaseModel

from src.constants import NO_GROUP
from src.db.models.chapter import Chapter as DbChapter
from src.db.models.manga import MangaService, MangaServiceWithId
from src.scheduler import LoggingDictCursor
from src.scrapers.base_scraper import BaseChapter, BaseScraper, \
    BaseChapterSimple
from src.tests.scrapers.testing_scraper import DummyScraper

originalParse = feedparser.parse

DONT_USE_TEMP_DATABASE = bool(os.environ.get('NO_TEMP_DB', False))

Postgresql: Optional[testing.postgresql.PostgresqlFactory] = None

EMPTY_SCRAPE_SERVICE: Tuple[List, List] = ([], [])
TEST_USER_ID = 3

if DONT_USE_TEMP_DATABASE:
    Postgresql = None
else:
    Postgresql = testing.postgresql.PostgresqlFactory(
        cache_initialized_db=True,
        initdb_args='-E=UTF8 -U postgres -A trust'
    )

T = TypeVar('T')


def run_migrations(conn: Connection) -> None:
    filepath = os.path.dirname(__file__)
    root = os.path.join(filepath, '..', '..')
    env = os.environ.copy()
    env['DB_USER'] = conn.info.user
    env['PGPASSWORD'] = conn.info.password
    env['DB_HOST'] = conn.info.host
    env['DB_NAME'] = conn.info.dbname
    env['DB_PORT'] = str(conn.info.port)
    cmd = 'npm run migrate:up && npm run migrate:test'
    p = subprocess.Popen(cmd, env=env, cwd=root, shell=True,
                         stdout=sys.stdout if DONT_USE_TEMP_DATABASE else subprocess.DEVNULL)
    p.wait()


def create_db(postgres: Optional[testing.postgresql.Postgresql]) -> Connection:
    conn = create_conn(postgres)
    run_migrations(conn)
    return conn


def create_conn(postgres: Optional[testing.postgresql.Postgresql]) -> Connection:
    if DONT_USE_TEMP_DATABASE or not postgres:
        conn = psycopg2.connect(
            host=os.environ['DB_HOST'],
            port=os.environ['DB_PORT'],
            dbname=os.environ['DB_NAME'],
            user=os.environ['DB_USER'],
            password=os.environ['PGPASSWORD'],
            cursor_factory=LoggingDictCursor
        )
    else:
        conn = psycopg2.connect(**postgres.dsn(),
                                cursor_factory=LoggingDictCursor)
    conn.set_client_encoding('UTF8')
    return conn


def start_db() -> None:
    if Postgresql:
        Postgresql.cache.start()


def get_conn() -> Connection:
    conn = create_conn(None if not Postgresql else Postgresql.cache)
    if conn.get_parameter_status('timezone') != 'UTC':
        with conn.cursor() as cur:
            cur.execute("SET TIMEZONE TO 'UTC'")
    return conn


def teardown_db() -> None:
    if not Postgresql:
        return None

    try:
        Postgresql.cache.stop()
    finally:
        Postgresql.clear_cache()


def mock_feedparse(feed, *args, **kwargs):
    def wrapper(*_, **__):
        return originalParse(feed, *args, **kwargs)

    return wrapper


# Actually returns a literal union between the input and MagicMock
def spy_on(instance: T) -> Union[T, mock.MagicMock]:
    return mock.MagicMock(spec_set=instance, wraps=instance)


def date_fix(d: datetime):
    if d.tzinfo and d.utcoffset().total_seconds() == 0:  # type: ignore[union-attr]
        return d.replace(tzinfo=None)
    return d


def set_db_environ():
    """
    Sets environment variables to match the created temporary database.
    """
    os.environ['ELASTIC_NODE'] = f"{os.getenv('ELASTIC_TEST_HOST', 'localhost')}:{os.getenv('ELASTIC_TEST_PORT', 9200)}"

    if DONT_USE_TEMP_DATABASE:
        return
    conf = Postgresql.cache.dsn()
    os.environ['DB_HOST'] = conf['host']
    os.environ['DB_NAME'] = conf.get('database', conf.get('dbname'))
    os.environ['DB_USER'] = conf['user']
    os.environ['DB_PASSWORD'] = ''
    os.environ['DB_PORT'] = str(conf['port'])


class BaseTestClasses:
    class TitleIdGenerator:
        def __init__(self):
            self._id = 0

        def generate(self, name: str) -> str:
            self._id += 1
            return f'{name}_{self._id}'

    class DatabaseTestCase(unittest.TestCase):
        _conn: Connection = NotImplemented
        _generator: 'BaseTestClasses.TitleIdGenerator' = NotImplemented

        @pytest.fixture(autouse=True, scope='class')
        def _setup_class(self, request: pytest.FixtureRequest, conn) -> None:
            request.cls._conn = conn
            # Integers are retained during tests but they reset to the default value
            # for some reason. Circumvent this by using a class.
            request.cls._generator = BaseTestClasses.TitleIdGenerator()

            request.addfinalizer(self._teardown_class)

        @property
        def conn(self) -> Connection:
            return self._conn

        @pytest.fixture(autouse=True)
        def _get_elasticsearch(self, es):
            self.elasticsearch = es

        @pytest.fixture(autouse=True)
        def _set_up_dbutil(self, dbutil):
            self.dbutil = dbutil

        def _teardown_class(self) -> None:
            self._conn.close()

        def get_str_id(self) -> str:
            return self._generator.generate(type(self).__name__)

        def get_manga_service(self, scraper: Type['BaseScraper'] = DummyScraper) -> MangaService:
            id_ = self.get_str_id()
            return MangaService(service_id=scraper.ID, title_id=id_,
                                title=f'{id_}_manga')

        def create_manga_service(self, scraper: Type['BaseScraper'] = DummyScraper) -> MangaServiceWithId:
            id_ = self.get_str_id()
            ms = MangaServiceWithId(service_id=scraper.ID, title_id=id_,
                                    title=f'{id_}_manga', manga_id=0)
            return self.dbutil.add_manga_service(ms, add_manga=True)

        def create_db_chapter_objects(self, manga: MangaService, n: int) -> List['DbChapter']:
            return [
                DbChapter(
                    manga_id=manga.manga_id, service_id=manga.service_id,
                    title=f'chapter_{id_}', chapter_number=1,
                    chapter_identifier=id_,
                    release_date=self.utcnow(),
                    group_id=NO_GROUP)
                for id_ in [self.get_str_id() for _ in range(n)]]

        def create_chapters(self, manga: MangaService, n: int) -> List[DbChapter]:
            chapters = self.create_db_chapter_objects(manga, n)
            inserted = {c.chapter_identifier: c.chapter_id for c in self.dbutil.add_chapters(chapters)}
            for c in chapters:
                c.chapter_id = inserted[c.chapter_identifier]

            return chapters

        def delete_chapters(self, service_id: int):
            self.dbutil.execute('DELETE FROM chapters WHERE service_id=%s',
                                (service_id,))

        def assertChapterEqualsRow(self, chapter: 'Chapter', row: DictRow) -> None:
            pairs = [
                ('chapter_title', 'title'),
                ('chapter_number', 'chapter_number'),
                ('decimal', 'chapter_decimal'),
                ('release_date', 'release_date',
                 lambda: (getattr(chapter, 'release_date'), date_fix(row['release_date']))
                 ),
                ('chapter_identifier', 'chapter_identifier'),
                ('group', 'group')
            ]

            for val in pairs:
                chapter_attr, row_attr = val[:2]
                if len(val) == 3:
                    get_vals = val[2]
                else:
                    def get_vals():
                        return getattr(chapter, chapter_attr), row[row_attr]

                c_val, r_val = get_vals()  # type: ignore[operator]
                if c_val != r_val:
                    self.fail(
                        'Chapter from database does not equal model\n'
                        f'{chapter_attr} != {row_attr}\n'
                        f'{c_val} != {row[row_attr]}'
                    )

        def assertDatesEqual(self, date1: datetime, date2: datetime):
            if date_fix(date1) != date_fix(date2):
                self.fail(f'Date {date1} does not match date {date2}')

        def assertDatesNotEqual(self, date1: datetime, date2: datetime):
            if date_fix(date1) == date_fix(date2):
                self.fail(f'Date {date1} equals date {date2}')

        def assertDateGreater(self, date1: datetime, date2: datetime):
            if date_fix(date1) <= date_fix(date2):
                self.fail(f'Date {date1} is earlier or equal to {date2}')

        def assertDateLess(self, date1: datetime, date2: datetime):
            if date_fix(date1) >= date_fix(date2):
                self.fail(f'Date {date1} is later or equal to {date2}')

        def assertDatesAlmostEqual(self, date1: datetime, date2: datetime,
                                   delta: timedelta = timedelta(seconds=1),
                                   msg: str = None):
            date1 = date_fix(date1)
            date2 = date_fix(date2)

            self.assertAlmostEqual(date1, date2, delta=delta, msg=msg)

        def assertMangaServiceExists(self, title_id: str, service_id: int):
            sql = 'SELECT 1 FROM manga_service WHERE service_id=%s AND title_id=%s'
            with self.conn.cursor() as cur:
                cur.execute(sql, (service_id, title_id))
                row = cur.fetchone()

            self.assertIsNotNone(row, msg=f'Manga {title_id} not found')

        def assertMangaWithTitleFound(self, title: str):
            self.assertIsNotNone(
                self.dbutil.find_manga_by_title(title),
                msg=f'Manga with title {title} not found when expected to be found'
            )

        @staticmethod
        def utcnow() -> datetime:
            """
            Return utc time with psycopg2 timezone
            """
            return datetime.utcnow().replace(tzinfo=psycopg2.tz.FixedOffsetTimezone(offset=0, name=None))

        @staticmethod
        def dbChapterSortKey(chapter: 'DbChapter'):
            return chapter.chapter_identifier

        def assertDbChaptersEqual(self, a: 'DbChapter', expected: 'DbChapter', include_id: bool = False):
            self.assertEqual(a.chapter_number, expected.chapter_number, msg=f'Chapter numbers not equal for {a.chapter_identifier}')
            self.assertEqual(a.chapter_decimal, expected.chapter_decimal, msg=f'Chapter decimal numbers not equal for {a.chapter_identifier}')
            self.assertDatesEqual(a.release_date, expected.release_date)
            self.assertEqual(a.chapter_identifier, expected.chapter_identifier, msg=f'Chapter identifiers not equal for {a.chapter_identifier}')
            self.assertEqual(a.manga_id, expected.manga_id, msg=f'Manga ids not equal for {a.chapter_identifier}')
            self.assertEqual(a.group, expected.group, msg=f'Chapter groups not equal for {a.chapter_identifier}')
            self.assertEqual(a.title, expected.title, msg=f'Chapter titles not equal for {a.chapter_identifier}')
            self.assertEqual(a.group_id, expected.group_id, msg=f'Group ids are not equal for {a.chapter_identifier}')
            self.assertEqual(a.service_id, expected.service_id, msg=f'Service ids not equal for {a.chapter_identifier}')

            if include_id:
                self.assertEqual(a.chapter_id, expected.chapter_id, msg=f'Chapter ids not equal for {a.chapter_identifier}')

        def assertAllDbChaptersEqual(self, chapters: List['DbChapter'], expected: List['DbChapter'], include_id: bool = False):
            self.assertEqual(len(chapters), len(expected), msg='Different amount of chapters passed')

            for chapter, expect in zip(
                    sorted(chapters, key=self.dbChapterSortKey),
                    sorted(expected, key=self.dbChapterSortKey)):
                self.assertDbChaptersEqual(chapter, expect, include_id=include_id)

    class ModelAssertions(unittest.TestCase):
        def assertChaptersEqual(self, a: Union[BaseChapter, 'ChapterTestModel', DbChapter],
                                b: Union[BaseChapter, 'ChapterTestModel'], ignore_date: bool = False):

            if isinstance(a, DbChapter):
                self.assertEqual(a.chapter_number, b.chapter_number, msg=f'Chapter numbers not equal for {a.chapter_identifier}')
                self.assertEqual(a.chapter_decimal, b.decimal, msg=f'Chapter decimal numbers not equal for {a.chapter_identifier}')

                if not ignore_date:
                    self.assertEqual(date_fix(a.release_date), b.release_date, msg=f'Chapter release dates not equal for {a.chapter_identifier}')

            else:
                self.assertEqual(a.chapter_title, b.chapter_title, msg=f'Chapter titles not equal for {a.chapter_identifier}')
                self.assertEqual(a.volume, b.volume, msg=f'Chapter volumes not equal for {a.chapter_identifier}')
                self.assertEqual(a.decimal, b.decimal, msg=f'Chapter decimal numbers not equal for {a.chapter_identifier}')
                self.assertEqual(a.title_id, b.title_id, msg=f'Manga title ids not equal for {a.chapter_identifier}')
                self.assertEqual(a.manga_title, b.manga_title, msg=f'Manga titles not equal for {a.chapter_identifier}')
                self.assertEqual(a.manga_url, b.manga_url, msg=f'Manga urls not equal for {a.chapter_identifier}')
                self.assertEqual(a.group, b.group, msg=f'Chapter groups not equal for {a.chapter_identifier}')

                if not ignore_date:
                    self.assertEqual(a.release_date, b.release_date, msg=f'Chapter release dates not equal for {a.chapter_identifier}')

            self.assertEqual(a.chapter_identifier, b.chapter_identifier, msg=f'Chapter identifiers not equal for {a.chapter_identifier}')

            self.assertEqual(a.title, b.title, msg=f'Chapter titles not equal for {a.chapter_identifier}')
            self.assertEqual(a.group_id, b.group_id, msg=f'Group ids are not equal for {a.chapter_identifier}')

        @staticmethod
        def chapterSortKey(chapter: Union[BaseChapter, 'ChapterTestModel']):
            return chapter.chapter_identifier

        def assertAllChaptersEqual(self, chapters: Union[List[BaseChapter], List['ChapterTestModel']],
                                   expected: Union[List[BaseChapter], List['ChapterTestModel']],
                                   ignore_date: bool = False):
            self.assertEqual(len(chapters), len(expected), msg='Different amount of chapters passed')

            for chapter, expect in zip(sorted(chapters, key=self.chapterSortKey), sorted(expected, key=self.chapterSortKey)):
                self.assertChaptersEqual(
                    typing.cast(BaseChapter, chapter),
                    typing.cast(BaseChapter, expect),
                    ignore_date=ignore_date
                )


class Chapter(BaseChapterSimple):
    def __init__(self, chapter_title: str = None, chapter_number: int = 0,
                 volume: int = None, decimal: int = None,
                 release_date: datetime = None, chapter_identifier: str = '',
                 title_id: str = '', manga_title: str = None,
                 manga_url: str = None, group: str = None,
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

    @property
    def title(self) -> str:
        return self.chapter_title or 'No title'


class ChapterTestModel(BaseModel):
    chapter_title: Optional[str]
    chapter_number: int
    volume: Optional[int]
    decimal: Optional[int]
    release_date: datetime
    chapter_identifier: str
    title_id: Optional[str]
    manga_title: Optional[str]
    manga_url: Optional[str]
    group: Optional[str]
    title: str
    group_id: int

    @classmethod
    def from_chapter(cls, c: BaseChapter):
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

    def __lt__(self, other):
        return self.chapter_identifier < other.chapter_identifier

    def __hash__(self):
        return hash(self.chapter_identifier)

    def __eq__(self, other):
        if hasattr(other, 'chapter_identifier'):
            return other.chapter_identifier == self.chapter_identifier
        else:
            return self.chapter_identifier == other


class ChapterSnapshot(BaseModel):
    data: List[ChapterTestModel]


def save_chapters_snapshot(chapters: List[BaseChapter], filename: str):
    chs = list(map(ChapterTestModel.from_chapter, chapters))

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(ChapterSnapshot(data=chs).json(ensure_ascii=False, indent=2))


def load_chapters_snapshot(filename: str) -> List[ChapterTestModel]:
    with open(filename, 'r', encoding='utf-8') as f:
        return ChapterSnapshot.parse_obj(json.load(f)).data
