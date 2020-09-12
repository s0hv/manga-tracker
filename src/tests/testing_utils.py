import os
import shlex
import unittest
import subprocess
from datetime import datetime
from typing import NoReturn, Generic, TypeVar, Optional
from unittest import mock

import feedparser
import psycopg2
import testing.postgresql
from psycopg2.extensions import connection as Connection
from psycopg2.extras import DictCursor, DictRow

from src.scrapers.base_scraper import BaseChapter
from src.utils.dbutils import DbUtil

originalParse = feedparser.parse

DONT_USE_TEMP_DATABASE = bool(os.environ.get('NO_TEMP_DB', False))

if DONT_USE_TEMP_DATABASE:
    Postgresql = None
else:
    Postgresql = testing.postgresql.PostgresqlFactory(
        cache_initialized_db=True,
        initdb_args='-E=UTF8 -U postgres -A trust'
    )

T = TypeVar('T')


def run_migrations(conn: Connection) -> NoReturn:
    filepath = os.path.dirname(__file__)
    root = os.path.join(filepath, '..', '..')
    env = os.environ.copy()
    env['DB_USER'] = conn.info.user
    env['PGPASSWORD'] = conn.info.password
    env['DB_HOST'] = conn.info.host
    env['DB_NAME'] = conn.info.dbname
    env['DB_PORT'] = str(conn.info.port)
    cmd = 'npm run migrate:up && npm run migrate:test'
    p = subprocess.Popen(shlex.split(cmd), env=env, cwd=root, shell=True,
                         stdout=subprocess.DEVNULL)
    p.wait()


def create_db(postgres: testing.postgresql.Postgresql) -> Connection:
    conn = create_conn(postgres)
    run_migrations(conn)
    return conn


def create_conn(postgres: Optional[testing.postgresql.Postgresql]) -> Connection:
    if DONT_USE_TEMP_DATABASE:
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


def start_db():
    if not DONT_USE_TEMP_DATABASE:
        Postgresql.cache.start()


def get_conn() -> Connection:
    conn = create_conn(None if DONT_USE_TEMP_DATABASE else Postgresql.cache)
    if conn.get_parameter_status('timezone') != 'UTC':
        with conn.cursor() as cur:
            cur.execute("SET TIMEZONE TO 'UTC'")
    return conn


def teardown_db() -> NoReturn:
    if DONT_USE_TEMP_DATABASE:
        return

    try:
        Postgresql.cache.stop()
    finally:
        Postgresql.clear_cache()


def mock_feedparse(feed, *args, **kwargs):
    def wrapper(*_, **__):
        return originalParse(feed, *args, **kwargs)

    return wrapper


def spy_on(instance: Generic[T]):
    return mock.MagicMock(spec_set=instance, wraps=instance)


def date_fix(d: datetime):
    if d.tzinfo and d.utcoffset().total_seconds() == 0:
        return d.replace(tzinfo=None)
    return d


class BaseTestClasses:

    class DatabaseTestCase(unittest.TestCase):
        def setUp(self) -> None:
            self._conn = get_conn()
            self.dbutil = DbUtil(self._conn)

        def tearDown(self) -> None:
            self._conn.close()

        def assertChapterEqualsRow(self, chapter: 'Chapter', row: DictRow) -> NoReturn:
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

                c_val, r_val = get_vals()
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


class Chapter(BaseChapter):
    def __init__(self, chapter_title: str = None, chapter_number: int = None,
                 volume: int = None, decimal: int = None,
                 release_date: datetime = None, chapter_identifier: str = None,
                 title_id: str = None, manga_title: str = None,
                 manga_url: str = None, group: str = None):
        self._chapter_title = chapter_title
        self._chapter_number = chapter_number
        self._volume = volume
        self._decimal = decimal
        self._release_date = release_date
        self._chapter_identifier = chapter_identifier
        self._title_id = title_id
        self._manga_title = manga_title
        self._manga_url = manga_url
        self._group = group

    @property
    def chapter_title(self) -> Optional[str]:
        return self._chapter_title

    @property
    def chapter_number(self) -> Optional[int]:
        return self._chapter_number

    @property
    def volume(self) -> Optional[int]:
        return self._volume

    @property
    def decimal(self) -> Optional[int]:
        return self._decimal

    @property
    def release_date(self) -> Optional[datetime]:
        return self._release_date

    @property
    def chapter_identifier(self) -> Optional[str]:
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
        return self.chapter_title
