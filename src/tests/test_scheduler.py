import unittest
from unittest import mock

from src.db.models.scheduled_run import ScheduledRun, ScheduledRunResult
from src.scheduler import UpdateScheduler
from src.scrapers import SCRAPERS, MangaPlus, MangaDex
from src.tests.scrapers.testing_scraper import DummyScraper
from src.tests.testing_utils import BaseTestClasses, spy_on, set_db_environ


class SchedulerRunTest(BaseTestClasses.DatabaseTestCase):
    scheduler: UpdateScheduler = NotImplemented

    @classmethod
    def setUpClass(cls) -> None:
        super(SchedulerRunTest, cls).setUpClass()
        set_db_environ()
        cls.scheduler = UpdateScheduler()

    def setUp(self) -> None:
        super().setUp()
        self.scraper1 = spy_on(DummyScraper(self.conn, self.dbutil))
        self.scraper2 = spy_on(DummyScraper(self.conn, self.dbutil))

        SCRAPERS[MangaPlus.URL] = lambda *_, **__: self.scraper1  # type: ignore[assignment]
        SCRAPERS[MangaDex.URL] = lambda *_, **__: self.scraper2  # type: ignore[assignment]

    def test_scheduled_runs_without_data(self):
        self.assertFalse(self.dbutil.get_scheduled_runs())

        self.scheduler.do_scheduled_runs()

    def test_scheduled_runs_with_data(self):
        manga_id = 1
        self.dbutil.add_scheduled_runs([
            ScheduledRun(manga_id=manga_id, service_id=MangaPlus.ID),
            ScheduledRun(manga_id=manga_id, service_id=MangaDex.ID)]
        )
        self.assertTrue(self.scheduler.do_scheduled_runs())
        self.scraper1.scrape_series.assert_called_with(mock.ANY, MangaPlus.ID, manga_id, feed_url=MangaPlus.FEED_URL)
        self.scraper2.scrape_series.assert_called_with(mock.ANY, MangaDex.ID, manga_id, feed_url=MangaDex.FEED_URL)

        self.assertFalse(self.dbutil.get_scheduled_runs())

        # Make sure cooldown is applied
        self.dbutil.add_scheduled_runs([
            ScheduledRun(manga_id=manga_id, service_id=MangaPlus.ID),
            ScheduledRun(manga_id=manga_id, service_id=MangaDex.ID)]
        )
        self.assertFalse(self.scheduler.do_scheduled_runs())
        self.assertFalse(self.dbutil.get_scheduled_runs())
        self.dbutil.execute('TRUNCATE TABLE scheduled_runs')

    def test_scheduled_runs_limit(self):
        limit = 1
        DummyScraper.CONFIG.scheduled_runs_enabled = True
        DummyScraper.CONFIG.scheduled_run_limit = limit

        ms1 = self.create_manga_service(DummyScraper)
        ms2 = self.create_manga_service(DummyScraper)

        # Add in two batches to force different timestamps
        self.dbutil.add_scheduled_runs([
            ScheduledRun(manga_id=ms1.manga_id, service_id=DummyScraper.ID)
        ])
        self.dbutil.add_scheduled_runs([
            ScheduledRun(manga_id=ms2.manga_id, service_id=DummyScraper.ID)
        ])

        # Only the oldest one should be run
        self.assertCountEqual(self.scheduler.do_scheduled_runs(), [ms1.manga_id])
        self.assertEqual(
            self.dbutil.get_all_scheduled_runs(),
            [ScheduledRunResult(manga_id=ms2.manga_id, service_id=ms2.service_id, title_id=ms2.title_id)]
        )

    def test_force_run_with_invalid_service(self):
        self.assertIsNone(self.scheduler.force_run(-1, 1))
        self.assertLogs('debug', 'warning')

    def test_force_run_with_invalid_manga(self):
        self.assertIsNone(self.scheduler.force_run(DummyScraper.ID, -1))
        self.assertLogs('debug', 'debug')

    def test_do_scheduled_runs_with_disabled_service(self):
        sql = 'UPDATE services SET disabled=TRUE WHERE service_id=%s'
        self.dbutil.execute(sql, [DummyScraper.ID])

        try:
            ms = self.create_manga_service(DummyScraper)
            self.dbutil.add_scheduled_runs([
                ScheduledRun(manga_id=ms.manga_id, service_id=DummyScraper.ID)
            ])
            self.assertFalse(self.scheduler.do_scheduled_runs())
        finally:
            sql = 'UPDATE services SET disabled=FALSE WHERE service_id=%s'
            self.dbutil.execute(sql, [DummyScraper.ID])
            self.dbutil.execute('TRUNCATE TABLE scheduled_runs')


if __name__ == '__main__':
    unittest.main()
