from datetime import datetime, timedelta
from typing import Optional

from psycopg import Connection
from psycopg.rows import DictRow

from src.db.models.services import ServiceConfig
from src.scrapers.base_scraper import BaseScraper
from src.utils.dbutils import DbUtil


class DummyScraper(BaseScraper):
    ID = 999
    URL = 'test_url'
    CHAPTER_URL_FORMAT = 'chapter/{}'
    MANGA_URL_FORMAT = 'manga/{}'
    NAME = 'Testing scraper'
    CONFIG = ServiceConfig(service_id=ID)

    def min_update_interval(self) -> timedelta:
        return timedelta(0)

    def scrape_series(self, title_id: str, service_id: int, manga_id: int,
                      feed_url: str | None = None):
        pass

    def scrape_service(self, service_id: int, feed_url: str,
                       last_update: Optional[datetime],
                       title_id: Optional[str] = None):
        pass

    def __init__(self, conn: Connection[DictRow], dbutil: Optional[DbUtil] = None):
        super().__init__(conn, dbutil)


class DummyScraper2(DummyScraper):
    ID = 1000
    URL = 'test_url2'
    CHAPTER_URL_FORMAT = 'chapter/{}'
    MANGA_URL_FORMAT = 'manga/{}'
    NAME = 'Testing scraper 2'
    CONFIG = ServiceConfig(service_id=ID)
