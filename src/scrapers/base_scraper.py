import abc
import logging
from abc import ABC
from collections.abc import Collection, Iterable, Mapping, Sequence
from datetime import datetime, timedelta, timezone
from inspect import isabstract
from itertools import groupby
from operator import attrgetter
from typing import TYPE_CHECKING, ClassVar, LiteralString, Optional, TypeVar, cast, override

import psycopg
import pydantic
import requests
from psycopg import Connection
from psycopg.rows import DictRow
from pydantic import BaseModel, Field

from src.db.mappers.chapter_mapper import ChapterMapper
from src.db.models.chapter import Chapter
from src.db.models.chapter import Chapter as ChapterModel
from src.db.models.manga import MangaService
from src.db.models.services import ServiceConfig
from src.utils.utilities import get_latest_chapters, utcnow

if TYPE_CHECKING:
    from src.utils.dbutils import DbUtil

logger = logging.getLogger('debug')


class BaseChapter(abc.ABC):
    @property
    @abc.abstractmethod
    def chapter_title(self) -> str | None:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def chapter_number(self) -> int:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def volume(self) -> int | None:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def decimal(self) -> int | None:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def release_date(self) -> datetime:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def chapter_identifier(self) -> str:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def title_id(self) -> str | None:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def manga_title(self) -> str | None:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def manga_url(self) -> str | None:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def group(self) -> str | None:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def title(self) -> str:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def group_id(self) -> int:
        """
        Should return the id of the group. Setting group id can be deferred
        but an error must be risen if it's get without a value
        """
        raise NotImplementedError

    @override
    def __str__(self) -> str:
        return f'{self.manga_title} {self.chapter_number} / {self.chapter_identifier}'

    @override
    def __hash__(self) -> int:
        return hash(self.chapter_identifier)

    @override
    def __eq__(self, other: object) -> bool:
        if isinstance(other, BaseChapter):
            return other.chapter_identifier == self.chapter_identifier
        else:
            return self.chapter_identifier == other

    @override
    def __ne__(self, other: object) -> bool:
        return not self.__eq__(other)

    def __lt__(self, other: object) -> bool:
        if isinstance(other, BaseChapter):
            return self.chapter_identifier < other.chapter_identifier
        raise TypeError(f'Incorrect type {type(other)} for less than operator')


class BaseChapterSimple(BaseChapter):
    """
    A sensible default implementation for a chapter
    """

    def __init__(
        self,
        chapter_title: str | None,
        chapter_number: int,
        chapter_identifier: str,
        title_id: str,
        volume: int | None = None,
        decimal: int | None = None,
        release_date: datetime | None = None,
        manga_title: str | None = None,
        manga_url: str | None = None,
        group: str | None = None,
        group_id: int | None = None,
    ):
        self._chapter_title = chapter_title
        self._chapter_number = chapter_number
        self._chapter_identifier = chapter_identifier
        self._title_id = title_id
        self._volume = volume
        self._decimal = decimal
        self._manga_title = manga_title
        self._manga_url = manga_url
        self._group = group
        self._release_date = release_date or utcnow()
        if self._release_date.tzinfo is None:
            self._release_date = self._release_date.replace(tzinfo=timezone.utc)

        self._group_id = group_id

    @override
    @property
    def chapter_title(self) -> str | None:
        return self._chapter_title

    @override
    @property
    def chapter_number(self) -> int:
        return self._chapter_number

    @override
    @property
    def volume(self) -> int | None:
        return self._volume

    @override
    @property
    def decimal(self) -> int | None:
        return self._decimal

    @override
    @property
    def release_date(self) -> datetime:
        return self._release_date

    @override
    @property
    def chapter_identifier(self) -> str:
        return self._chapter_identifier

    @override
    @property
    def title_id(self) -> str:
        return self._title_id

    @override
    @property
    def manga_title(self) -> str | None:
        return self._manga_title

    @override
    @property
    def manga_url(self) -> str | None:
        return self._manga_url

    @override
    @property
    def group(self) -> str | None:
        return self._group

    # Does not work when setter is defined
    @override  # type: ignore[explicit-override]
    @property
    def group_id(self) -> int:
        if self._group_id is None:
            raise ValueError(f'Group id is None. Expected it to be int {self}')
        return self._group_id

    @group_id.setter
    def group_id(self, value: int) -> None:
        self._group_id = value

    @override
    @property
    def title(self) -> str:
        return (
            self.chapter_title
            or f'{"Volume " + str(self.volume) + ", " if self.volume is not None else ""}Chapter {self.chapter_number}{"" if not self.decimal else "." + str(self.decimal)}'
        )

    @override
    def __repr__(self) -> str:
        return f'{self._chapter_title} {self._chapter_identifier} - {self._title_id}'


ScraperChapter = TypeVar('ScraperChapter', bound=BaseChapter)


class ScrapeServiceRetVal(BaseModel):
    manga_ids: set[int] = Field(default_factory=set)
    chapter_ids: set[int] = Field(default_factory=set)


class BaseScraper(abc.ABC):
    ID: ClassVar[int] = NotImplemented
    """Database id of this service"""

    UPDATE_INTERVAL: ClassVar[timedelta] = timedelta(hours=1)
    """The minimum time between two updates of this service"""

    URL: ClassVar[str] = NotImplemented
    """URL to the website of this service"""

    FEED_URL: ClassVar[str] = NotImplemented
    """URL of the feed (usually rss feed) of this service"""

    NAME: ClassVar[str] = NotImplemented
    """Name of this service"""

    CHAPTER_URL_FORMAT: ClassVar[str] = NotImplemented
    """Format of chapter urls"""

    MANGA_URL_FORMAT: ClassVar[str] = NotImplemented
    """Format of manga urls"""

    CONFIG: ServiceConfig = NotImplemented
    """Service configuration values"""

    @override
    def __init_subclass__(cls, **kwargs: dict):
        # Ignore for abstract classes
        if isabstract(cls):
            return

        if cls.ID is NotImplemented:
            raise NotImplementedError("Service doesn't have the ID class property")

        if cls.URL is NotImplemented:
            raise NotImplementedError("Service doesn't have the URL class property")

    def __init__(self, conn: Connection[DictRow], dbutil: Optional['DbUtil'] = None):
        if self.CONFIG is NotImplemented:
            raise NotImplementedError(f'Service config value not set for {type(self).__name__}')

        self._conn = conn
        if dbutil is None:
            from src.utils.dbutils import DbUtil

            self._dbutil = DbUtil(conn, None)
        else:
            self._dbutil = dbutil

    @property
    def conn(self) -> Connection[DictRow]:
        return self._conn

    @property
    def dbutil(self) -> 'DbUtil':
        return self._dbutil

    def set_checked(self, service_id: int, is_manga: bool = False) -> None:  # noqa: ARG002
        with self.conn.cursor() as cursor:
            now = utcnow()
            disabled_until = now + self.min_update_interval()
            sql: LiteralString = (
                'UPDATE services SET last_check = %s, disabled_until = %s WHERE service_id=%s'
            )
            try:
                cursor.execute(sql, (utcnow(), disabled_until, service_id))
            except psycopg.Error:
                logger.exception(f'Failed to update last check of {service_id}')
                return

    def min_update_interval(self) -> timedelta:
        """
        Minimum time between two checks on this service
        """
        return self.CONFIG.check_interval

    def next_update(self) -> datetime:
        return utcnow() + self.min_update_interval()

    @abc.abstractmethod
    def scrape_series(
        self, title_id: str, service_id: int, manga_id: int, feed_url: str | None
    ) -> set[int] | None:
        """
        Returns:
            Set of new chapter ids.
            Returns None if updating failed
        """
        raise NotImplementedError

    @abc.abstractmethod
    def scrape_service(
        self,
        service_id: int,
        feed_url: str,
        last_update: datetime | None,
        title_id: str | None = None,
    ) -> ScrapeServiceRetVal | None:
        raise NotImplementedError

    def add_service(self) -> int | None:
        sql: LiteralString = 'SELECT 1 FROM services WHERE url=%s OR service_id=%s'
        with self.conn.cursor() as cur:
            cur.execute(sql, (self.URL, self.ID))
            if cur.fetchone():
                logger.error(
                    f'Service {self.NAME} already exists with duplicate url {self.URL} or id {self.ID}'
                )
                return None

        logger.info(f'Adding service {self.NAME} {self.URL}')
        sql: LiteralString = """
            INSERT INTO services (service_id, service_name, url, disabled, last_check, chapter_url_format, manga_url_format, disabled_until)
            VALUES (%s, %s, %s, FALSE, NULL, %s, %s, NULL) RETURNING service_id"""
        with self.conn.transaction(), self.conn.cursor() as cur:
            cur.execute(
                sql, (self.ID, self.NAME, self.URL, self.CHAPTER_URL_FORMAT, self.MANGA_URL_FORMAT)
            )
            row = cur.fetchone()
            if not row:
                raise ValueError('Row is None after service insert')
            return row['service_id']

    @staticmethod
    def titles_dict_to_manga_service(
        titles: Mapping[str, Sequence[BaseChapter]],
        service_id: int,
        disabled: bool = False,
        manga_title: str | None = None,
    ) -> list[MangaService]:
        """
        Turns a dict[title_id, chapters] into a list of MangaService objects.
        """
        mangas: list[MangaService] = []
        for title_id, chapters in titles.items():
            mangas.append(
                MangaService(
                    service_id=service_id,
                    disabled=disabled,
                    title_id=title_id,
                    title=manga_title if manga_title is not None else chapters[0].manga_title,
                )
            )

        return mangas

    @staticmethod
    def group_by_manga(chapters: Iterable[ScraperChapter]) -> dict[str, list[ScraperChapter]]:
        titles: dict[str, list[ScraperChapter]] = {}
        # Must be sorted for groupby to work, as it only splits the list each time the key changes
        for k, g in groupby(sorted(chapters, key=attrgetter('title_id')), attrgetter('title_id')):
            titles[k] = list(g)

        return titles

    def map_already_added_titles(
        self, service_id: int, titles: dict[str, list[ScraperChapter]], manga_ids: set[int]
    ) -> list[ChapterModel]:
        """
        Maps the chapters of titles that already exist to the database model.
        Updates the given manga_ids set with the manga that were found.
        """
        chapters: list[ChapterModel] = []

        for ms in self.dbutil.find_added_titles(service_id, tuple(titles.keys())):
            # Manga id has been set so it can't be None
            manga_ids.add(ms.manga_id)  # type: ignore[arg-type]
            for chapter in titles.pop(ms.title_id):
                chapters.append(ChapterMapper.base_chapter_to_db(chapter, ms.manga_id, service_id))

        return chapters

    def update_latest_chapter(self, chapters: Iterable[ChapterModel]) -> None:
        chapter_rows = [
            {
                'chapter_decimal': c.chapter_decimal,
                'manga_id':        c.manga_id,
                'chapter_number':  c.chapter_number,
                'release_date':    c.release_date,
            }
            for c in chapters
        ]
        self.dbutil.update_latest_chapter(
            tuple(c for c in get_latest_chapters(chapter_rows).values())
        )

    def add_new_manga_with_dupe_check(
        self,
        service_id: int,
        mangas: Sequence[MangaService],
        manga_ids: set[int],
        chapters: list[ChapterModel],
        titles: dict[str, list[ScraperChapter]],
    ) -> None:
        """
        Calls DbUtil.add_new_manga_and_check_duplicate_titles
        to add the given manga to the database with checks for duplicate titles.
        Adds appropriate ChapterModel objects to the chapters list
        """
        for manga in self.dbutil.add_new_manga_and_check_duplicate_titles(mangas):
            manga_ids.add(manga.manga_id)
            for chapter in titles.get(manga.title_id, []):
                try:
                    chapters.append(
                        ChapterMapper.base_chapter_to_db(chapter, manga.manga_id, service_id)
                    )
                except pydantic.ValidationError:
                    logger.exception(f'Failed to map chapter {chapter} to db model')

    def get_new_entries(
        self, service_id: int, entries: Collection[ScraperChapter]
    ) -> Collection[ScraperChapter] | None:
        """
        Get only the new chapters to a service. Returns None if no new entries found.
        """
        entries = self.dbutil.get_only_latest_entries(service_id, entries)
        if not entries:
            logger.info(f'No new entries found for {type(self).__name__}')
            return None

        logger.info(
            '%s new chapters found for %s. %s',
            len(entries),
            self.NAME,
            [e.chapter_identifier for e in entries],
        )

        return entries

    def fetch_url(
        self, url: str, headers: dict[str, str] | None = None
    ) -> requests.Response | None:
        try:
            r = requests.get(url, headers=headers)
        except requests.RequestException:
            logger.exception(f'Failed to fetch {self.__class__.__name__} url {url}')
            return None

        if not r.ok:
            logger.error(
                f'Failed to fetch {self.__class__.__name__} url {url}. HTTP {r.status_code}'
            )
            return None

        return r

    def handle_adding_chapters(
        self, entries: Collection[ScraperChapter], service_id: int
    ) -> ScrapeServiceRetVal | None:
        """
        Given a list of parsed chapters this method will filter out already added chapters,
        add new manga and check for duplicate title, add the new chapters and return the updated manga ids
        Args:
            entries: List of chapters
            service_id: id of the service

        Returns:
            Updated manga ids or None if update was not done
        """
        entries = self.get_new_entries(service_id, entries)
        if not entries:
            return None

        titles = self.group_by_manga(entries)

        chapters: list[Chapter] = []
        manga_ids = set()

        # Find already added titles
        for ms in self.dbutil.find_added_titles(service_id, tuple(titles.keys())):
            manga_ids.add(ms.manga_id)
            for chapter in titles.pop(ms.title_id):
                chapters.append(ChapterMapper.base_chapter_to_db(chapter, ms.manga_id, service_id))

        # Add new manga
        mangas = self.titles_dict_to_manga_service(titles, service_id, True)

        self.add_new_manga_with_dupe_check(
            service_id,
            mangas,
            cast(set[int], manga_ids),
            chapters,
            titles
        )

        inserted = self.dbutil.add_chapters(chapters, fetch=True)

        self.update_latest_chapter(chapters)

        # At this point the set has no None values
        return ScrapeServiceRetVal(
            manga_ids=cast(set[int], manga_ids),
            chapter_ids={row.chapter_id for row in inserted}
        )


class BaseScraperWhole(BaseScraper, ABC):
    @override
    def add_service(self) -> int | None:
        service_id = super().add_service()
        if not service_id:
            return None
        with self.conn.transaction(), self.conn.cursor() as cur:
            sql = (
                'INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id) '
                'VALUES (%s, %s, NULL, NULL, NULL)'
            )
            cur.execute(sql, (service_id, self.FEED_URL))

        return service_id

    @override
    def set_checked(self, service_id: int, is_manga: bool = False) -> None:
        """
        Sets the service and service_whole as checked based on the min_update_interval
        defined by the service
        """
        try:
            super().set_checked(service_id)
            self.dbutil.update_service_whole(service_id, self.min_update_interval())
        except psycopg.Error:
            logger.exception(f'Failed to update service {service_id}')
