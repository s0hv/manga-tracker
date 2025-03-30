import unittest
from datetime import timedelta
from typing import cast, override
from unittest import mock
from unittest.mock import MagicMock, patch

import psycopg
import pytest
from psycopg.rows import class_row

from src.db.models.manga import MangaServiceWithId
from src.db.models.notifications import PartialNotificationInfo, UserNotification
from src.db.models.scheduled_run import ScheduledRun, ScheduledRunResult
from src.notifier import DiscordEmbedWebhookNotifier
from src.scheduler import MangaServiceInfo, UpdateScheduler
from src.scrapers import SCRAPERS, MangaDex, MangaPlus
from src.tests.scrapers.testing_scraper import DummyScraper, DummyScraper2
from src.tests.testing_utils import (
    EMPTY_SCRAPE_SERVICE,
    TEST_USER_ID,
    BaseTestClasses,
    set_db_environ,
    spy_on,
)
from src.utils.utilities import utcnow


class SchedulerRunTest(BaseTestClasses.DatabaseTestCase):
    scheduler: UpdateScheduler = NotImplemented

    @pytest.fixture(autouse=True, scope='class')
    def _set_up_scheduler(self, request: pytest.FixtureRequest) -> None:
        set_db_environ()
        request.cls.scheduler = UpdateScheduler()

    @override
    def setUp(self) -> None:
        super().setUp()
        self.scraper1 = spy_on(DummyScraper(self.conn, self.dbutil))
        self.scraper2 = spy_on(DummyScraper(self.conn, self.dbutil))

        SCRAPERS[MangaPlus.URL] = lambda *_, **__: self.scraper1  # type: ignore[assignment]
        SCRAPERS[MangaDex.URL] = lambda *_, **__: self.scraper2  # type: ignore[assignment]

    def create_notification(self, user_id: int = TEST_USER_ID, use_follows: bool = False, dest: str | None = None) -> UserNotification:
        sql = 'INSERT INTO user_notifications (notification_type, user_id, use_follows) VALUES (1, %s, %s) RETURNING *'
        with self.conn.transaction():
            with self.conn.cursor() as cur:
                cur.execute(sql, (user_id, use_follows))
                d = self.dbutil.fetchone_or_throw(cur)
                sql = 'INSERT INTO notification_options (notification_id, destination) VALUES (%s, %s) RETURNING destination, group_by_manga'
                cur.execute(sql, (d['notification_id'], dest or self.get_str_id()))
                return UserNotification(**d, **self.dbutil.fetchone_or_throw(cur))

    def create_notification_manga(self, notification_id: int, manga_id: int, service_id: int | None = None) -> PartialNotificationInfo:
        sql = (
            'INSERT INTO notification_manga (notification_id, manga_id, service_id) '
            'VALUES (%s, %s, %s) RETURNING *'
        )
        with self.conn.transaction():
            with self.conn.cursor(row_factory=class_row(PartialNotificationInfo)) as cur:
                cur.execute(sql, (notification_id, manga_id, service_id))
                return self.dbutil.fetchone_or_throw(cur)

    def test_scheduled_runs_without_data(self):
        assert not self.dbutil.get_scheduled_runs()

        self.scheduler.do_scheduled_runs()

    def test_scheduled_runs_with_data(self):
        manga_id = 1
        self.dbutil.add_scheduled_runs([
            ScheduledRun(manga_id=manga_id, service_id=MangaPlus.ID),
            ScheduledRun(manga_id=manga_id, service_id=MangaDex.ID)]
        )
        assert self.scheduler.do_scheduled_runs()
        self.scraper1.scrape_series.assert_called_with(mock.ANY, MangaPlus.ID, manga_id, feed_url=MangaPlus.FEED_URL)  # type: ignore[union-attr]
        self.scraper2.scrape_series.assert_called_with(mock.ANY, MangaDex.ID, manga_id, feed_url=MangaDex.FEED_URL)# type: ignore[union-attr]

        assert not self.dbutil.get_scheduled_runs()

        # Make sure cooldown is applied
        self.dbutil.add_scheduled_runs([
            ScheduledRun(manga_id=manga_id, service_id=MangaPlus.ID),
            ScheduledRun(manga_id=manga_id, service_id=MangaDex.ID)]
        )
        assert self.scheduler.do_scheduled_runs() == EMPTY_SCRAPE_SERVICE
        assert not self.dbutil.get_scheduled_runs()
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
        assert self.scheduler.do_scheduled_runs() == ([ms1.manga_id], [])
        assert self.dbutil.get_all_scheduled_runs() == [ScheduledRunResult(manga_id=ms2.manga_id, service_id=ms2.service_id, title_id=ms2.title_id)]
        self.dbutil.execute('TRUNCATE TABLE scheduled_runs')

    def test_scheduled_runs_when_its_disabled(self):
        DummyScraper.CONFIG.scheduled_runs_enabled = False

        ms1 = self.create_manga_service(DummyScraper)

        # Add in two batches to force different timestamps
        self.dbutil.add_scheduled_runs([
            ScheduledRun(manga_id=ms1.manga_id, service_id=DummyScraper.ID)
        ])

        # Only the oldest one should be run
        assert self.scheduler.do_scheduled_runs() == ([], [])
        assert self.dbutil.get_all_scheduled_runs() == []
        self.dbutil.execute('TRUNCATE TABLE scheduled_runs')

    def test_scheduled_runs_when_manga_service_does_not_exist(self):
        """
        Scheduled runs should ignore manga_id, service_id pairs that do not exist,
        and they should not contribute to the run limit.
        """
        limit = 1
        DummyScraper.CONFIG.scheduled_runs_enabled = True
        DummyScraper.CONFIG.scheduled_run_limit = limit

        ms1 = self.create_manga_service(DummyScraper2)
        ms2 = self.create_manga_service(DummyScraper)

        # Add in two batches to force different timestamps
        self.dbutil.add_scheduled_runs([
            ScheduledRun(manga_id=ms1.manga_id, service_id=DummyScraper.ID),
            ScheduledRun(manga_id=ms2.manga_id, service_id=DummyScraper.ID)
        ])

        # Only the oldest one should be run
        assert self.scheduler.do_scheduled_runs() ==([ms2.manga_id], [])
        assert self.dbutil.get_all_scheduled_runs() == []
        self.dbutil.execute('TRUNCATE TABLE scheduled_runs')

    def test_force_run_with_invalid_service(self):
        assert self.scheduler.force_run(-1, 1) is None
        self.assertLogs('debug', 'warning')

    def test_force_run_with_invalid_manga(self):
        assert self.scheduler.force_run(DummyScraper.ID, -1) is None
        self.assertLogs('debug', 'debug')

    def test_do_scheduled_runs_with_disabled_service(self):
        sql = 'UPDATE services SET disabled=TRUE WHERE service_id=%s'
        self.dbutil.execute(sql, [DummyScraper.ID])

        try:
            ms = self.create_manga_service(DummyScraper)
            self.dbutil.add_scheduled_runs([
                ScheduledRun(manga_id=ms.manga_id, service_id=DummyScraper.ID)
            ])
            assert self.scheduler.do_scheduled_runs() == EMPTY_SCRAPE_SERVICE
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

        assert notify_mock.call_count == 2

        notif_ids = [args.args[1].notification_id for args in notify_mock.call_args_list]
        assert nm1.notification_id in notif_ids
        assert nm2.notification_id in notif_ids

        chapter_counts = [len(args.args[0]) for args in notify_mock.call_args_list]
        assert len(chapters1) in chapter_counts
        assert len(chapters2) in chapter_counts

        for info in [
            self.dbutil.get_notification_info(notif1.notification_id),
            self.dbutil.get_notification_info(notif2.notification_id)
        ]:
            assert info.times_run == notif_times_run
            assert info.failed_in_row == 0
            assert info.times_failed == 0

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

        assert notify_mock.call_count == 1

        notif_ids = [args.args[1].notification_id for args in
                     notify_mock.call_args_list]
        assert nm1.notification_id in notif_ids

        chapter_counts = [len(args.args[0]) for args in
                          notify_mock.call_args_list]
        assert len(chapters1) in chapter_counts

        info = self.dbutil.get_notification_info(notif1.notification_id)
        assert info.times_run == notif_times_run
        assert info.failed_in_row == 1
        assert info.times_failed == 1


class SchedulerScrapeServiceTest(BaseTestClasses.DatabaseTestCase):
    scheduler: UpdateScheduler = NotImplemented

    @pytest.fixture(autouse=True, scope='class')
    def _set_up_scheduler(self, request: pytest.FixtureRequest) -> None:
        set_db_environ()
        request.cls.scheduler = UpdateScheduler()

    @override
    def setUp(self) -> None:
        super().setUp()
        self.scraper1 = spy_on(DummyScraper(self.conn, self.dbutil))

        SCRAPERS[MangaPlus.URL] = lambda *_, **__: self.scraper1  # type: ignore[assignment]

    @staticmethod
    def create_manga_info(ms: MangaServiceWithId) -> MangaServiceInfo:
        return {
            'manga_id': ms.manga_id,
            'title_id': ms.title_id,
            'service_id': ms.service_id,
            'feed_url': ms.feed_url
        }

    def test_scrape_service_successfully(self):
        ms1 = self.create_manga_service(DummyScraper)
        mock_chapters = [1, 2, 3]
        self.scraper1.scrape_series.return_value = mock_chapters  # type: ignore[union-attr]

        manga_info = self.create_manga_info(ms1)

        manga_ids, chapter_ids = self.scheduler.scrape_series(
            DummyScraper.ID,
            lambda *_, **__: self.scraper1,  # type: ignore[arg-type]
            [manga_info]
        )

        assert manga_ids == {ms1.manga_id}
        assert chapter_ids == mock_chapters

        assert self.scraper1.scrape_series.call_count == 1  # type: ignore[union-attr]
        assert self.scraper1.set_checked.call_count == 1  # type: ignore[union-attr]

    def test_scrape_service_stops_after_2_errors(self):
        ms1 = self.create_manga_service(DummyScraper)
        assert ms1.next_update is None

        self.scraper1.scrape_series.side_effect = [Exception('mock error'), psycopg.Error('mock db error')]  # type: ignore[union-attr]
        next_update = utcnow() + timedelta(hours=1)
        self.scraper1.next_update.return_value = next_update  # type: ignore[union-attr]

        manga_info = self.create_manga_info(ms1)
        manga_ids, chapter_ids = self.scheduler.scrape_series(
            DummyScraper.ID,
            lambda *_, **__: self.scraper1,  # type: ignore[arg-type]
            [manga_info, manga_info, manga_info]
        )

        assert len(manga_ids) == 0
        assert chapter_ids == []

        assert self.scraper1.scrape_series.call_count == 2  # type: ignore[union-attr]
        assert self.scraper1.set_checked.call_count == 1  # type: ignore[union-attr]
        assert self.scraper1.next_update.call_count == 2  # type: ignore[union-attr]

        ms = self.dbutil.get_manga_service(ms1.service_id, ms1.title_id)
        assert ms is not None
        self.assertDatesEqual(ms.next_update, next_update)

    def test_scrape_service_stops_after_none_returned_2_times(self):
        ms1 = self.create_manga_service(DummyScraper)
        self.scraper1.scrape_series.return_value = None  # type: ignore[union-attr]
        self.scraper1.next_update.return_value = utcnow() + timedelta(hours=1)  # type: ignore[union-attr]

        manga_info = self.create_manga_info(ms1)
        manga_ids, chapter_ids = self.scheduler.scrape_series(
            DummyScraper.ID,
            lambda *_, **__: self.scraper1,  # type: ignore[arg-type]
            [manga_info, manga_info, manga_info]
        )

        assert len(manga_ids) == 0
        assert chapter_ids == []

        assert self.scraper1.scrape_series.call_count == 2  # type: ignore[union-attr]
        assert self.scraper1.set_checked.call_count == 1  # type: ignore[union-attr]
        assert self.scraper1.next_update.call_count == 0  # type: ignore[union-attr]

        found_ms1 = self.dbutil.get_manga_service(ms1.service_id, ms1.title_id)
        assert found_ms1 is not None
        assert found_ms1.next_update is None


if __name__ == '__main__':
    unittest.main()
