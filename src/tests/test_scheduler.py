import unittest
from typing import Optional, cast
from unittest import mock
from unittest.mock import patch, MagicMock

import pytest
from psycopg.rows import class_row

from src.db.models.notifications import UserNotification, \
    PartialNotificationInfo
from src.db.models.scheduled_run import ScheduledRun, ScheduledRunResult
from src.notifier import DiscordEmbedWebhookNotifier
from src.scheduler import UpdateScheduler
from src.scrapers import SCRAPERS, MangaPlus, MangaDex
from src.tests.scrapers.testing_scraper import DummyScraper
from src.tests.testing_utils import (
    BaseTestClasses, spy_on, set_db_environ, EMPTY_SCRAPE_SERVICE, TEST_USER_ID
)


class SchedulerRunTest(BaseTestClasses.DatabaseTestCase):
    scheduler: UpdateScheduler = NotImplemented

    @pytest.fixture(autouse=True, scope='class')
    def _set_up_scheduler(self, request: pytest.FixtureRequest) -> None:
        set_db_environ()
        request.cls.scheduler = UpdateScheduler()

    def setUp(self) -> None:
        super().setUp()
        self.scraper1 = spy_on(DummyScraper(self.conn, self.dbutil))
        self.scraper2 = spy_on(DummyScraper(self.conn, self.dbutil))

        SCRAPERS[MangaPlus.URL] = lambda *_, **__: self.scraper1  # type: ignore[assignment]
        SCRAPERS[MangaDex.URL] = lambda *_, **__: self.scraper2  # type: ignore[assignment]

    def create_notification(self, user_id: int = TEST_USER_ID, use_follows: bool = False, dest: Optional[str] = None) -> UserNotification:
        sql = 'INSERT INTO user_notifications (notification_type, user_id, use_follows) VALUES (1, %s, %s) RETURNING *'
        with self.conn.transaction():
            with self.conn.cursor() as cur:
                cur.execute(sql, (user_id, use_follows))
                d = self.dbutil.fetchone_or_throw(cur)
                sql = 'INSERT INTO notification_options (notification_id, destination) VALUES (%s, %s) RETURNING destination, group_by_manga'
                cur.execute(sql, (d['notification_id'], dest or self.get_str_id()))
                return UserNotification(**d, **self.dbutil.fetchone_or_throw(cur))

    def create_notification_manga(self, notification_id: int, manga_id: int, service_id: Optional[int] = None) -> PartialNotificationInfo:
        sql = 'INSERT INTO notification_manga (notification_id, manga_id, service_id) ' \
              'VALUES (%s, %s, %s) RETURNING *'
        with self.conn.transaction():
            with self.conn.cursor(row_factory=class_row(PartialNotificationInfo)) as cur:
                cur.execute(sql, (notification_id, manga_id, service_id))
                return self.dbutil.fetchone_or_throw(cur)

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
        self.scraper1.scrape_series.assert_called_with(mock.ANY, MangaPlus.ID, manga_id, feed_url=MangaPlus.FEED_URL)  # type: ignore[union-attr]
        self.scraper2.scrape_series.assert_called_with(mock.ANY, MangaDex.ID, manga_id, feed_url=MangaDex.FEED_URL)# type: ignore[union-attr]

        self.assertFalse(self.dbutil.get_scheduled_runs())

        # Make sure cooldown is applied
        self.dbutil.add_scheduled_runs([
            ScheduledRun(manga_id=manga_id, service_id=MangaPlus.ID),
            ScheduledRun(manga_id=manga_id, service_id=MangaDex.ID)]
        )
        self.assertEqual(self.scheduler.do_scheduled_runs(), EMPTY_SCRAPE_SERVICE)
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
        self.assertCountEqual(self.scheduler.do_scheduled_runs(), ([ms1.manga_id], []))
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
            self.assertEqual(self.scheduler.do_scheduled_runs(), EMPTY_SCRAPE_SERVICE)
        finally:
            sql = 'UPDATE services SET disabled=FALSE WHERE service_id=%s'
            self.dbutil.execute(sql, [DummyScraper.ID])
            self.dbutil.execute('TRUNCATE TABLE scheduled_runs')

    @patch.object(DiscordEmbedWebhookNotifier, 'send_notification')
    def test_send_notifications(self, notify_mock: MagicMock):
        ms1 = self.create_manga_service()
        chapters1 = self.create_chapters(ms1, 4)
        ms2 = self.create_manga_service()
        chapters2 = self.create_chapters(ms2, 5)

        notif1 = self.create_notification()
        nm1 = self.create_notification_manga(notif1.notification_id, ms1.manga_id)

        notif2 = self.create_notification()
        nm2 = self.create_notification_manga(notif2.notification_id, ms2.manga_id, ms2.service_id)

        notif_times_run = 5
        notify_mock.return_value = notif_times_run, True

        self.scheduler.send_notifications(
            {ms1.manga_id, ms2.manga_id},
            [cast(int, c.chapter_id) for c in [*chapters1, *chapters2]]
        )

        self.assertEqual(notify_mock.call_count, 2)

        notif_ids = [args.args[1].notification_id for args in notify_mock.call_args_list]
        self.assertIn(nm1.notification_id, notif_ids)
        self.assertIn(nm2.notification_id, notif_ids)

        chapter_counts = [len(args.args[0]) for args in notify_mock.call_args_list]
        self.assertIn(len(chapters1), chapter_counts)
        self.assertIn(len(chapters2), chapter_counts)

        for info in [
            self.dbutil.get_notification_info(notif1.notification_id),
            self.dbutil.get_notification_info(notif2.notification_id)
        ]:
            self.assertEqual(info.times_run, notif_times_run)
            self.assertEqual(info.failed_in_row, 0)
            self.assertEqual(info.times_failed, 0)

    @patch.object(DiscordEmbedWebhookNotifier, 'send_notification')
    def test_send_notifications_failed(self, notify_mock: MagicMock):
        ms1 = self.create_manga_service()
        chapters1 = self.create_chapters(ms1, 4)

        notif1 = self.create_notification()
        nm1 = self.create_notification_manga(notif1.notification_id,
                                             ms1.manga_id)

        notif_times_run = 2
        notify_mock.return_value = notif_times_run, False

        self.scheduler.send_notifications(
            {ms1.manga_id},
            [cast(int, c.chapter_id) for c in chapters1]
        )

        self.assertEqual(notify_mock.call_count, 1)

        notif_ids = [args.args[1].notification_id for args in
                     notify_mock.call_args_list]
        self.assertIn(nm1.notification_id, notif_ids)

        chapter_counts = [len(args.args[0]) for args in
                          notify_mock.call_args_list]
        self.assertIn(len(chapters1), chapter_counts)

        info = self.dbutil.get_notification_info(notif1.notification_id)
        self.assertEqual(info.times_run, notif_times_run)
        self.assertEqual(info.failed_in_row, 1)
        self.assertEqual(info.times_failed, 1)


if __name__ == '__main__':
    unittest.main()
