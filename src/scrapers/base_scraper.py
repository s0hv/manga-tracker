import abc
import logging
from datetime import timedelta, datetime
from inspect import isabstract
from itertools import groupby
from operator import attrgetter
from typing import (Optional, TYPE_CHECKING, ClassVar, Set, Dict, List,
                    Sequence,
                    Iterable, TypeVar, Mapping)

import psycopg2
from psycopg2.extensions import connection as Connection

from src.db.mappers.chapter_mapper import ChapterMapper
from src.db.models.chapter import Chapter as ChapterModel
from src.db.models.manga import MangaService

if TYPE_CHECKING:
    from src.utils.dbutils import DbUtil

logger = logging.getLogger('debug')


class BaseChapter(abc.ABC):
    @property
    @abc.abstractmethod
    def chapter_title(self) -> Optional[str]:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def chapter_number(self) -> int:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def volume(self) -> Optional[int]:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def decimal(self) -> Optional[int]:
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
    def title_id(self) -> Optional[str]:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def manga_title(self) -> Optional[str]:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def manga_url(self) -> Optional[str]:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def group(self) -> Optional[str]:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def title(self) -> str:
        raise NotImplementedError

    def __str__(self):
        return f'{self.manga_title} {self.chapter_number} / {self.chapter_identifier}'

    def __hash__(self):
        return hash(self.chapter_identifier)

    def __eq__(self, other):
        if isinstance(other, BaseChapter):
            return other.chapter_identifier == self.chapter_identifier
        else:
            return self.chapter_identifier == other

    def __ne__(self, other):
        return not self.__eq__(other)

    def __lt__(self, other):
        if isinstance(other, BaseChapter):
            return self.chapter_identifier < other.chapter_identifier
        raise TypeError(f'Incorrect type {type(other)} for less than operator')


ScraperChapter = TypeVar('ScraperChapter', bound=BaseChapter)


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

    def __init_subclass__(cls, **kwargs):
        # Ignore for abstract classes
        if isabstract(cls):
            return

        if cls.ID is NotImplemented:
            raise NotImplementedError("Service doesn't have the ID class property")

        if cls.URL is NotImplemented:
            raise NotImplementedError("Service doesn't have the URL class property")

    def __init__(self, conn, dbutil: 'DbUtil'):
        self._conn = conn
        self._dbutil = dbutil

    @property
    def conn(self) -> Connection:
        return self._conn

    @property
    def dbutil(self) -> 'DbUtil':
        return self._dbutil

    def set_checked(self, service_id: int) -> None:
        with self.conn.cursor() as cursor:
            now = datetime.utcnow()
            disabled_until = now + self.min_update_interval()
            sql = "UPDATE services SET last_check=%s, disabled_until=%s WHERE service_id=%s"
            try:
                cursor.execute(sql, (datetime.utcnow(), disabled_until, service_id))
            except psycopg2.Error:
                logger.exception(f'Failed to update last check of {service_id}')
                return

        self.conn.commit()

    @staticmethod
    def min_update_interval() -> timedelta:
        """
        Minimum time between two checks on this service
        """
        raise NotImplementedError

    def next_update(self) -> datetime:
        return datetime.utcnow() + self.min_update_interval()

    @abc.abstractmethod
    def scrape_series(self, title_id: str, service_id: int, manga_id: int, feed_url: Optional[str] = None) -> Optional[bool]:
        """
        Returns:
            Boolean that tells if the manga was updated (True) or not (False).
            Returns None if updating failed
        """
        raise NotImplementedError

    @abc.abstractmethod
    def scrape_service(self, service_id: int, feed_url: str, last_update: Optional[datetime],
                       title_id: Optional[str] = None) -> Optional[Set[int]]:
        raise NotImplementedError

    def add_service(self):
        sql = 'SELECT 1 FROM services WHERE url=%s OR service_id=%s'
        with self.conn.cursor() as cur:
            cur.execute(sql, (self.URL, self.ID))
            if cur.fetchone():
                logger.error(f'Service {self.NAME} already exists with duplicate url {self.URL} or id {self.ID}')
                return

        logger.info(f'Adding service {self.NAME} {self.URL}')
        sql = 'INSERT INTO services (service_id, service_name, url, disabled, last_check, chapter_url_format, manga_url_format, disabled_until) VALUES ' \
              '(%s, %s, %s, FALSE, NULL, %s, %s, NULL) RETURNING service_id'
        with self.conn:
            with self.conn.cursor() as cur:
                cur.execute(sql, (self.ID, self.NAME, self.URL, self.CHAPTER_URL_FORMAT, self.MANGA_URL_FORMAT))
                return cur.fetchone()[0]

    def add_service_whole(self) -> Optional[int]:
        service_id = BaseScraper.add_service(self)
        if not service_id:
            return None
        with self.conn:
            with self.conn.cursor() as cur:
                sql = 'INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id) VALUES ' \
                      '(%s, %s, NULL, NULL, NULL)'
                cur.execute(sql, (service_id, self.FEED_URL))

        return service_id

    @staticmethod
    def titles_dict_to_manga_service(
            titles: Mapping[str, Sequence[BaseChapter]],
            service_id: int, disabled: bool = False) -> List[MangaService]:
        """
        Turns a dict Dict[title_id, chapters] into a list of MangaService objects.
        """
        mangas: List[MangaService] = []
        for title_id, chapters in titles.items():
            ch = chapters[0]
            mangas.append(
                MangaService(
                    service_id=service_id,
                    disabled=disabled,
                    title_id=title_id,
                    title=ch.manga_title)
            )

        return mangas

    @staticmethod
    def group_by_manga(chapters: Iterable[ScraperChapter]) -> Dict[str, List[ScraperChapter]]:
        titles: Dict[str, List[ScraperChapter]] = {}
        # Must be sorted for groupby to work, as it only splits the list each time the key changes
        for k, g in groupby(sorted(chapters, key=attrgetter('title_id')),
                            attrgetter('title_id')):  # type: ignore
            titles[k] = list(g)  # type: ignore[index]

        return titles

    def map_already_added_titles(self, service_id: int, titles: Dict[str, List[ScraperChapter]],
                                 manga_ids: Set[int]) -> List[ChapterModel]:
        """
        Maps the chapters of titles that already exist to the database model.
        Updates the given manga_ids set with the manga that were found.
        """
        chapters: List[ChapterModel] = []

        for ms in self.dbutil.find_added_titles(service_id, tuple(titles.keys())):
            # Manga id has been set so it can't be None
            manga_ids.add(ms.manga_id)  # type: ignore[arg-type]
            for chapter in titles.pop(ms.title_id):
                chapters.append(
                    ChapterMapper.base_chapter_to_db(chapter, ms.manga_id,
                                                     service_id))

        return chapters
