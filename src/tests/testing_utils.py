import os
import subprocess
import sys
import unittest
from datetime import datetime, timedelta
from typing import TypeVar, Optional, Union, ClassVar
from unittest import mock

import feedparser
import psycopg2
import testing.postgresql  # type: ignore[import]
from psycopg2.extensions import connection as Connection
from psycopg2.extras import DictCursor, DictRow

from src.db.models.manga import Manga, MangaService
from src.scrapers.base_scraper import BaseChapter
from src.utils.dbutils import DbUtil

originalParse = feedparser.parse

DONT_USE_TEMP_DATABASE = bool(os.environ.get('NO_TEMP_DB', False))

Postgresql: Optional[testing.postgresql.PostgresqlFactory] = None

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
            cursor_factory=DictCursor
        )
    else:
        conn = psycopg2.connect(**postgres.dsn(),
                                cursor_factory=DictCursor)
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
    if DONT_USE_TEMP_DATABASE:
        return
    conf = Postgresql.cache.dsn()
    os.environ['DB_HOST'] = conf['host']
    os.environ['DB_NAME'] = conf.get('database', conf.get('dbname'))
    os.environ['DB_USER'] = conf['user']
    os.environ['DB_PASSWORD'] = ''
    os.environ['DB_PORT'] = str(conf['port'])


class BaseTestClasses:

    class DatabaseTestCase(unittest.TestCase):
        _conn: ClassVar[Connection] = NotImplemented

        @classmethod
        def setUpClass(cls) -> None:
            cls._conn = get_conn()

        @property
        def conn(self) -> Connection:
            return self._conn

        def setUp(self) -> None:
            self.dbutil = DbUtil(self._conn)

        @classmethod
        def tearDownClass(cls) -> None:
            cls._conn.close()

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

        @staticmethod
        def utcnow() -> datetime:
            """
            Return utc time with psycopg2 timezone
            """
            return datetime.utcnow().replace(tzinfo=psycopg2.tz.FixedOffsetTimezone(offset=0, name=None))

    class ModelAssertions(unittest.TestCase):
        def assertChaptersEqual(self, a: BaseChapter, b: BaseChapter):
            self.assertEqual(a.chapter_title, b.chapter_title)
            self.assertEqual(a.chapter_number, b.chapter_number)
            self.assertEqual(a.volume, b.volume)
            self.assertEqual(a.decimal, b.decimal)
            self.assertEqual(a.release_date, b.release_date)
            self.assertEqual(a.chapter_identifier, b.chapter_identifier)
            self.assertEqual(a.title_id, b.title_id)
            self.assertEqual(a.manga_title, b.manga_title)
            self.assertEqual(a.manga_url, b.manga_url)
            self.assertEqual(a.group, b.group)
            self.assertEqual(a.title, b.title)

        def assertMangaEqual(self, a: Manga, b: Manga):
            self.assertEqual(a.manga_id, b.manga_id)
            self.assertEqual(a.title, b.title)
            self.assertEqual(a.release_interval, b.release_interval)
            self.assertEqual(a.latest_release, b.latest_release)
            self.assertEqual(a.estimated_release, b.estimated_release)
            self.assertEqual(a.latest_chapter, b.latest_chapter)
            """
            self.assertEqual(a.aliases, b.aliases)
            self.assertEqual(a.cover, b.cover)
            self.assertEqual(a.status, b.status)
            self.assertEqual(a.artist, b.artist)
            self.assertEqual(a.author, b.author)
            self.assertEqual(a.bookwalker, b.bookwalker)
            self.assertEqual(a.baka_updates, b.baka_updates)
            self.assertEqual(a.mal, b.mal)
            self.assertEqual(a.amazon, b.amazon)
            self.assertEqual(a.ebook_japan, b.ebook_japan)
            self.assertEqual(a.official_engtl, b.official_engtl)
            self.assertEqual(a.raw, b.raw)
            self.assertEqual(a.novel_updates, b.novel_updates)
            self.assertEqual(a.kitsu, b.kitsu)
            self.assertEqual(a.anime_planet, b.anime_planet)
            self.assertEqual(a.anilist, b.anilist)
            """

        def assertMangaServiceEqual(self, a: MangaService, b: MangaService):
            self.assertMangaEqual(a, b)

            self.assertEqual(a.service_id, b.service_id)
            self.assertEqual(a.disabled, b.disabled)
            self.assertEqual(a.title_id, b.title_id)
            self.assertEqual(a.last_check, b.last_check)
            self.assertEqual(a.next_update, b.next_update)
            self.assertEqual(a.feed_url, b.feed_url)
            self.assertEqual(a.latest_decimal, b.latest_decimal)


class Chapter(BaseChapter):
    def __init__(self, chapter_title: str = None, chapter_number: int = 0,
                 volume: int = None, decimal: int = None,
                 release_date: datetime = None, chapter_identifier: str = '',
                 title_id: str = None, manga_title: str = None,
                 manga_url: str = None, group: str = None):
        self._chapter_title = chapter_title
        self._chapter_number = chapter_number
        self._volume = volume
        self._decimal = decimal
        self._release_date = release_date or datetime.utcnow()
        self._chapter_identifier = chapter_identifier
        self._title_id = title_id
        self._manga_title = manga_title
        self._manga_url = manga_url
        self._group = group

    @property
    def chapter_title(self) -> Optional[str]:
        return self._chapter_title

    @property
    def chapter_number(self) -> int:
        return self._chapter_number

    @property
    def volume(self) -> Optional[int]:
        return self._volume

    @property
    def decimal(self) -> Optional[int]:
        return self._decimal

    @property
    def release_date(self) -> datetime:
        return self._release_date

    @property
    def chapter_identifier(self) -> str:
        return self._chapter_identifier

    @property
    def title_id(self) -> Optional[str]:
        return self._title_id

    @property
    def manga_title(self) -> Optional[str]:
        return self._manga_title

    @property
    def manga_url(self) -> Optional[str]:
        return self._manga_url

    @property
    def group(self) -> Optional[str]:
        return self._group

    @property
    def title(self) -> str:
        return self.chapter_title or 'No title'
