import abc
import logging
from datetime import timedelta, datetime

import psycopg2

logger = logging.getLogger('debug')


class BaseChapter(abc.ABC):
    @property
    @abc.abstractmethod
    def chapter_title(self):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def chapter_number(self):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def volume(self):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def decimal(self):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def release_date(self):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def chapter_identifier(self):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def title_id(self):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def manga_title(self):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def manga_url(self):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def group(self):
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def title(self):
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


class BaseScraper(abc.ABC):
    UPDATE_INTERVAL = timedelta(hours=1)
    URL = None
    FEED_URL = None
    NAME = None
    CHAPTER_URL_FORMAT = ''
    MANGA_URL_FORMAT = ''

    def __init_subclass__(cls, **kwargs):
        if cls.URL is None:
            raise NotImplementedError("Service doesn't have the URL class property")

    def __init__(self, conn, dbutil):
        self._conn = conn
        self._dbutil = dbutil

    @property
    def conn(self):
        return self._conn

    @property
    def dbutil(self):
        return self._dbutil

    def set_checked(self, service_id):
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
    def min_update_interval():
        raise NotImplementedError

    @abc.abstractmethod
    def scrape_series(self, title_id, service_id, manga_id):
        raise NotImplementedError

    @abc.abstractmethod
    def scrape_service(self, service_id, feed_url, last_update, title_id=None):
        raise NotImplementedError

    def add_service(self):
        sql = 'SELECT 1 FROM services WHERE url=%s'
        with self.conn.cursor() as cur:
            cur.execute(sql, (self.URL,))
            if cur.fetchone():
                logger.info(f'Service {self.NAME} already exists')
                return

        logger.info(f'Adding service {self.NAME} {self.URL}')
        sql = 'INSERT INTO services (service_name, url, disabled, last_check, chapter_url_format, manga_url_format, disabled_until) VALUES ' \
              '(%s, %s, FALSE, NULL, %s, %s, NULL) RETURNING service_id'
        with self.conn:
            with self.conn.cursor() as cur:
                cur.execute(sql, (self.NAME, self.URL, self.CHAPTER_URL_FORMAT, self.MANGA_URL_FORMAT))
                return cur.fetchone()[0]

    def add_service_whole(self):
        service_id = BaseScraper.add_service(self)
        if not service_id:
            return
        with self.conn:
            with self.conn.cursor() as cur:
                sql = 'INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id) VALUES ' \
                      '(%s, %s, NULL, NULL, NULL)'
                cur.execute(sql, (service_id, self.FEED_URL))

        return service_id
