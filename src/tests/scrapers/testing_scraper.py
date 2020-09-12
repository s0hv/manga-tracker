from datetime import datetime, timedelta
from typing import Optional

from src.scrapers.base_scraper import BaseScraper
from src.utils.dbutils import DbUtil


class TestingScraper(BaseScraper):
    ID = 999
    URL = 'test_url'
    CHAPTER_URL_FORMAT = 'chapter/{}'
    MANGA_URL_FORMAT = 'manga/{}'
    NAME = 'Testing scraper'

    @staticmethod
    def min_update_interval() -> timedelta:
        return timedelta(0)

    def scrape_series(self, title_id: str, service_id: int, manga_id: int):
        pass

    def scrape_service(self, service_id: int, feed_url: str,
                       last_update: Optional[datetime],
                       title_id: Optional[str] = None):
        pass

    def __init__(self, conn, dbutil: DbUtil):
        super().__init__(conn, dbutil)
