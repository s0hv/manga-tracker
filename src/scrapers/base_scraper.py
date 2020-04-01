import abc
import logging
from datetime import timedelta, datetime

import psycopg2

logger = logging.getLogger('debug')


class BaseChapter(abc.ABC):
    @property
    def chapter_title(self):
        raise NotImplementedError

    @property
    def chapter_number(self):
        raise NotImplementedError

    @property
    def volume(self):
        raise NotImplementedError

    @property
    def decimal(self):
        raise NotImplementedError

    @property
    def release_date(self):
        raise NotImplementedError

    @property
    def chapter_identifier(self):
        raise NotImplementedError

    @property
    def manga_id(self):
        raise NotImplementedError

    @property
    def manga_title(self):
        raise NotImplementedError

    @property
    def manga_url(self):
        raise NotImplementedError

    @property
    def group(self):
        raise NotImplementedError

    @property
    def title(self):
        raise NotImplementedError


class BaseScraper(abc.ABC):
    UPDATE_INTERVAL = timedelta(hours=1)
    URL = None

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
