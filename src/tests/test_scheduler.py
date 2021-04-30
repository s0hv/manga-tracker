import unittest
from unittest import mock

from src.db.models.scheduled_run import ScheduledRun
from src.scheduler import UpdateScheduler
from src.scrapers import SCRAPERS, MangaPlus, MangaDex
from src.tests.scrapers.testing_scraper import DummyScraper
from src.tests.testing_utils import BaseTestClasses, spy_on, set_db_environ


class SchedulerRunTest(BaseTestClasses.DatabaseTestCase):
    def setUp(self) -> None:
        super().setUp()

        set_db_environ()

        self.scraper1 = spy_on(DummyScraper(self.conn, self.dbutil))
        self.scraper2 = spy_on(DummyScraper(self.conn, self.dbutil))
        self.scheduler = UpdateScheduler()

        SCRAPERS.clear()
        SCRAPERS[MangaPlus.URL] = lambda *_, **__: self.scraper1  # type: ignore[assignment]
        SCRAPERS[MangaDex.URL] = lambda *_, **__: self.scraper2  # type: ignore[assignment]

    def test_scheduled_runs_without_data(self):
        with self._conn.cursor() as cur:
            self.assertFalse(any(False for _ in self.dbutil.get_scheduled_runs(cur)))

        self.scheduler.do_scheduled_runs()

    def test_scheduled_runs_with_data(self):
        manga_id = 1
        self.dbutil.add_scheduled_runs([
            ScheduledRun(manga_id=manga_id, service_id=MangaPlus.ID),
            ScheduledRun(manga_id=manga_id, service_id=MangaDex.ID)]
        )
        self.scheduler.do_scheduled_runs()
        self.scraper1.scrape_series.assert_called_with(mock.ANY, MangaPlus.ID, manga_id, feed_url=None)
        self.scraper2.scrape_series.assert_called_with(mock.ANY, MangaDex.ID, manga_id, feed_url=mock.ANY)

        with self._conn.cursor() as cur:
            self.assertFalse(any(False for _ in self.dbutil.get_scheduled_runs(cur)))


if __name__ == '__main__':
    unittest.main()
