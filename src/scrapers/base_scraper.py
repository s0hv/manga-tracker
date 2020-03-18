import abc
from datetime import timedelta


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

    def __init__(self, conn):
        self._conn = conn
        if self._conn.get_parameter_status('timezone') != 'UTC':
            with self._conn.cursor() as cur:
                cur.execute("SET TIMEZONE TO 'UTC'")

    @property
    def conn(self):
        return self._conn

    @abc.abstractmethod
    def scrape_series(self, title_id, service_id, manga_id):
        raise NotImplementedError

    @abc.abstractmethod
    def scrape_service(self, service_id, feed_url, last_update, title_id=None):
        raise NotImplementedError
