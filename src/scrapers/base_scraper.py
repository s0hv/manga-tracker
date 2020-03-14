import abc


class BaseScraper(abc.ABC):
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
