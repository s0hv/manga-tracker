import abc
import logging
from datetime import timedelta, datetime
from typing import Optional

import psycopg2
from psycopg2.extensions import connection as Connection

from src.utils.dbutils import DbUtil

logger = logging.getLogger('debug')


class BaseChapter(metaclass=abc.ABCMeta):
    @property
    @abc.abstractmethod
    def chapter_title(self) -> Optional[str]:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def chapter_number(self) -> Optional[int]:
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
    def release_date(self) -> Optional[datetime]:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def chapter_identifier(self) -> Optional[str]:
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
        return f'{self.manga_title} / {self.title_id}'

    def __hash__(self):
        return hash(self.chapter_identifier)

    def __eq__(self, other):
        if isinstance(other, BaseChapter):
            return other.chapter_identifier == self.chapter_identifier
        else:
            return self.chapter_identifier == other

    def __ne__(self, other):
        return not self.__eq__(other)


class BaseScraper(metaclass=abc.ABCMeta):
    ID: int = None
    UPDATE_INTERVAL: timedelta = timedelta(hours=1)
    URL: str = None
    FEED_URL: str = None
    NAME: str = None
    CHAPTER_URL_FORMAT: str = ''
    MANGA_URL_FORMAT: str = ''

    def __init_subclass__(cls, **kwargs):
        if cls.ID is None:
            raise NotImplementedError("Service doesn't have the ID class property")

        if cls.URL is None:
            raise NotImplementedError("Service doesn't have the URL class property")

    def __init__(self, conn, dbutil: DbUtil):
        self._conn = conn
        self._dbutil = dbutil

    @property
    def conn(self) -> Connection:
        return self._conn

    @property
    def dbutil(self) -> DbUtil:
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
    def scrape_service(self, service_id: int, feed_url: str, last_update: Optional[datetime], title_id: Optional[str] = None):
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
            return
        with self.conn:
            with self.conn.cursor() as cur:
                sql = 'INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id) VALUES ' \
                      '(%s, %s, NULL, NULL, NULL)'
                cur.execute(sql, (service_id, self.FEED_URL))

        return service_id
