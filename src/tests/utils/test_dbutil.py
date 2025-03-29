import statistics
import unittest
from datetime import datetime, timedelta, timezone

import psycopg

from src.constants import NO_GROUP
from src.db.models.chapter import Chapter as ChapterModel
from src.db.models.manga import (
    Manga,
    MangaService,
    MangaServicePartial,
    MangaServiceWithId,
    MangaWithId,
)
from src.db.models.services import Service
from src.tests.scrapers.testing_scraper import DummyScraper, DummyScraper2
from src.tests.testing_utils import BaseTestClasses, Chapter, spy_on
from src.utils.utilities import utcnow

testing_series = {
    'test_manga_1': [
        Chapter(
            chapter_title='test 1',
            chapter_number=1,
            volume=1,
            release_date=utcnow(),
            chapter_identifier='test_id_1_1',
            title_id='test_manga_1',
            manga_title='test manga 1'
        ),
        Chapter(
            chapter_title='test 2.5',
            chapter_number=2,
            decimal=5,
            volume=1,
            release_date=utcnow(),
            chapter_identifier='test_id_1_2.5',
            title_id='test_manga_1',
            manga_title='test manga 1',
        ),
        Chapter(
            chapter_title='test 1 no vol',
            chapter_number=1,
            release_date=utcnow(),
            chapter_identifier='test_id_1_1_alt',
            title_id='test_manga_1',
            manga_title='test manga 1'
        )
    ],
    'test_manga_2': [
        Chapter(
            chapter_title='abc 1',
            chapter_number=1,
            volume=1,
            release_date=utcnow(),
            chapter_identifier='test_id_2_1',
            title_id='test_manga_2',
            manga_title='test manga 2'
        ),
        Chapter(
            chapter_title='abc 2.5',
            chapter_number=2,
            decimal=2,
            volume=1,
            release_date=utcnow(),
            chapter_identifier='test_id_2_2.5',
            title_id='test_manga_2',
            manga_title='test manga 2'
        ),
        Chapter(
            chapter_title='abc 1 no vol',
            chapter_number=1,
            volume=0,
            release_date=utcnow(),
            chapter_identifier='test_id_2_1_alt',
            title_id='test_manga_2',
            manga_title='test manga 2',
            manga_url='abc',
        )
    ]
}


class BaseDbutilTest(BaseTestClasses.DatabaseTestCase):
    def setUp(self) -> None:
        super().setUp()

        self.test_scraper = DummyScraper(self._conn, self.dbutil)
        self.test_scraper2 = DummyScraper2(self.conn, self.dbutil)


class TestSplitExistingManga(BaseDbutilTest):
    def test_does_nothing_with_empty_list(self):
        """
        Test that nothing is done with an empty list
        """
        with self.conn.transaction():
            with self.conn.cursor() as cur:
                cur = spy_on(cur)
                retval = self.dbutil.split_existing_manga(DummyScraper.ID, [], cur=cur)
                self.assertTupleEqual(retval, ([], []))
                cur.execute.assert_not_called()  # type: ignore[union-attr]

    def test_with_no_existing(self):
        prefix = self.get_str_id()
        m1 = Manga(title=f'{prefix}_test 1')
        m2 = Manga(title=f'{prefix}_test 2')

        mangas = [m1, m2]

        exists, not_exists = self.dbutil.split_existing_manga(
            DummyScraper.ID, mangas
        )

        self.assertFalse(exists)
        self.assertEqual(not_exists, mangas)

    def test_with_existing_in_service(self):
        """
        Should not count as manga that already exist in the service as existing
        """
        prefix = self.get_str_id()
        m1 = MangaService(title=f'{prefix}_test 1',
                          service_id=DummyScraper.ID,
                          disabled=False,
                          title_id=self.get_str_id())
        m2 = Manga(title=f'{prefix}_test 2')

        self.dbutil.add_manga_service(m1, add_manga=True)

        mangas = [m1, m2]

        exists, not_exists = self.dbutil.split_existing_manga(
            DummyScraper.ID, mangas
        )

        self.assertFalse(exists)
        self.assertEqual(not_exists, [m1, m2])

    def test_with_existing_not_in_service(self):
        """
        Should not count as manga that already exist in the service as existing
        """
        prefix = self.get_str_id()
        title1 = f'{prefix}_test 1'
        title2 = f'{prefix}_test 2'
        title3 = f'{prefix}_test 3'

        m1 = Manga(title=title1)  # exists
        m2 = Manga(title=title2)  # exists
        m3 = Manga(title=title3)  # does not exist

        m11 = Manga(title=title1)
        m22 = MangaService(title=title2,
                           service_id=DummyScraper2.ID,
                           disabled=False,
                           title_id=self.get_str_id())
        m33 = MangaService(title=title3,
                           service_id=DummyScraper.ID,
                           disabled=False,
                           title_id=self.get_str_id())

        self.dbutil.add_new_manga(m11)
        self.dbutil.add_manga_service(m22, add_manga=True)
        self.dbutil.add_manga_service(m33, add_manga=True)

        mangas = [m1, m2, m3]

        exists, not_exists = self.dbutil.split_existing_manga(
            DummyScraper.ID, mangas
        )

        self.assertEqual(exists, [m1, m2])
        self.assertEqual(not_exists, [m3])


class TestGetAndAddManga(BaseDbutilTest):
    def get_unique_manga(self) -> Manga:
        return Manga(title=f'{self.get_str_id()}_manga')

    def test_add_new_manga(self):
        manga = self.get_unique_manga()
        retval = self.dbutil.add_new_manga(manga)
        self.assertIs(manga, retval)
        self.assertIsNotNone(manga.manga_id)

        self.assertEqual(manga, self.get_manga_db(manga.manga_id))

    def test_add_new_manga_service_without_manga_id(self):
        title_id = self.get_str_id()
        manga = MangaService(
            service_id=DummyScraper.ID, disabled=False,
            title_id=title_id, title=f'{title_id}_manga'
        )

        dbutil = spy_on(self.dbutil)

        self.assertRaises(psycopg.IntegrityError, dbutil.add_manga_service, manga)
        dbutil.add_new_manga.assert_not_called()  # type: ignore[union-attr]
        self.assertIsNone(self.dbutil.get_manga_service(manga.service_id, manga.title_id))

    def test_add_new_manga_service(self):
        title_id = self.get_str_id()
        manga = MangaService(
            service_id=DummyScraper.ID,
            disabled=False,
            title_id=title_id,
            title=f'{title_id}_manga',
            last_check=self.utcnow()
        )

        self.dbutil.add_manga_service(manga, add_manga=True)
        self.assertIsNotNone(manga.manga_id)

        self.assertEqual(
            self.dbutil.get_manga_service(manga.service_id, title_id),
            MangaServiceWithId.from_manga_service(manga)
        )

    def test_add_new_manga_service_all_properties(self):
        title_id = self.get_str_id()
        manga = MangaService(service_id=DummyScraper.ID,
                             disabled=True,
                             title_id=title_id,
                             last_check=self.utcnow(),
                             next_update=self.utcnow(),
                             feed_url='test value',
                             latest_decimal=1,
                             title=f'{title_id}_manga',
                             release_interval=timedelta(hours=1),
                             latest_release=self.utcnow(),
                             estimated_release=self.utcnow(),
                             latest_chapter=5,
                             views=10)
        self.dbutil.add_manga_service(manga, add_manga=True)

        # Assert inserted rows map and match correctly
        self.assertIsNotNone(manga.manga_id)
        self.assertEqual(
            self.dbutil.get_manga_service(manga.service_id, title_id),
            MangaServiceWithId.from_manga_service(manga)
        )
        self.assertEqual(
            self.get_manga_db(manga.manga_id),
            Manga(**manga.model_dump())
        )

    def test_get_manga_invalid_id(self):
        self.assertIsNone(self.dbutil.get_manga(-1))

    def test_get_manga_service_invalid_id(self):
        self.assertIsNone(self.dbutil.get_manga_service(DummyScraper.ID, 'undefined'))


class TestAddNewMangaWithDuplicates(BaseDbutilTest):
    def test_add_new_series_and_chapters(self) -> None:
        """
        Tests that new manga and chapters are added correctly
        """
        new_chapters = []
        new_manga = []
        retval = self.dbutil.add_new_manga_and_check_duplicate_titles(
            DummyScraper.titles_dict_to_manga_service(testing_series, DummyScraper.ID)
        )
        self.assertTrue(retval, msg='No manga added')

        for ms in retval:
            chapters = testing_series.get(ms.title_id, [])
            self.assertTrue(chapters, msg=f'Chapters not found for manga {ms}')
            new_chapters.extend(chapters)
            new_manga.append((ms.manga_id, chapters))

            self.dbutil.add_chapters(chapters, ms.manga_id, DummyScraper.ID)

        self._conn.commit()

        self.assertEqual(len(new_manga), len(testing_series), 'Chapter counts not equal')

        for manga_id, chapters in new_manga:
            c: Chapter = chapters[0]
            self.assertGreater(len(chapters), 0)
            self.assertListEqual(chapters, testing_series[c.title_id])

            with self._conn.cursor() as cur:
                sql = 'SELECT * FROM chapters WHERE manga_id=%s AND service_id=%s'
                cur.execute(sql, (manga_id, DummyScraper.ID))
                rows = cur.fetchall()
                self.assertEqual(len(chapters), len(rows), 'Not all chapters found from database')

            for c in chapters:
                row = filter(
                    lambda r: r['chapter_identifier'] == c.chapter_identifier,
                    rows
                )
                self.assertChapterEqualsRow(c, next(row))

            with self._conn.cursor() as cur:
                sql = 'SELECT m.title, ms.* FROM manga m ' \
                      '     INNER JOIN manga_service ms ON m.manga_id = ms.manga_id ' \
                      'WHERE m.manga_id=%s AND ms.service_id=%s'

                cur.execute(sql, (manga_id, DummyScraper.ID))
                manga = cur.fetchone()

            self.assertIsNotNone(manga)
            assert manga is not None
            self.assertEqual(c.manga_title, manga['title'])
            self.assertEqual(c.title_id, manga['title_id'])
            self.assertFalse(manga['disabled'])

    def test_add_new_series_empty(self):
        with self._conn.transaction():
            with self._conn.cursor() as cur:
                cur = spy_on(cur)
                retval = self.dbutil.add_new_manga_and_check_duplicate_titles([])
                self.assertEqual(len(retval), 0, msg='Manga added when empty list passed')
                cur.execute.assert_not_called()  # type: ignore[union-attr]

    def test_add_new_manga_with_only_duplicates(self):
        service_id = 1
        mangas = [
            MangaService(service_id=service_id, disabled=False,
                         title_id='test1',
                         manga_id=None, title='test 1'),
            MangaService(service_id=service_id, disabled=False,
                         title_id='test2',
                         manga_id=None, title='test 1'),
        ]

        with self.conn.transaction():
            with self.conn.cursor() as cur:
                cur = spy_on(cur)
                self.assertFalse(self.dbutil.add_new_manga_and_check_duplicate_titles(mangas, cur=cur))
                cur.execute.assert_not_called()  # type: ignore[union-attr]

    def test_add_new_manga_with_multiple_same_matches(self):
        service_id = DummyScraper.ID
        title = 'Manga test'

        id1 = self.dbutil.add_manga_service(
            MangaService(service_id=DummyScraper2.ID, title_id=self.get_str_id(), title=title),
            add_manga=True
        ).manga_id
        id2 = self.dbutil.add_manga_service(
            MangaService(service_id=DummyScraper2.ID, title_id=self.get_str_id(), title=title),
            add_manga=True
        ).manga_id

        mangas = [
            MangaService(service_id=service_id, disabled=False,
                         title_id='test_matches_1',
                         manga_id=None, title=title)
        ]

        with self.conn.transaction():
            with self.conn.cursor() as cur:
                retval = self.dbutil.add_new_manga_and_check_duplicate_titles(mangas, cur=cur)
                self.assertListEqual(retval, list(MangaServiceWithId.from_manga_services(mangas)))

                self.assertNotIn(retval[0].manga_id, [id1, id2])

    def test_add_new_manga_with_same_input_titles(self):
        service_id = 1
        title = 'test'

        mangas = [
            MangaService(service_id=service_id, disabled=False,
                         title_id=self.get_str_id(),
                         manga_id=None, title=title),
            MangaService(service_id=service_id, disabled=False,
                         title_id=self.get_str_id(),
                         manga_id=None, title=title),
        ]

        with self.conn.transaction():
            with self.conn.cursor() as cur:
                cur = spy_on(cur)

                self.assertFalse(self.dbutil.add_new_manga_and_check_duplicate_titles(mangas, cur=cur))
                cur.execute.assert_not_called()  # type: ignore[union-attr]

    def test_add_new_manga_with_existing_title(self):
        service_id = DummyScraper.ID
        title = 'Very Unique Title'

        manga = self.dbutil.add_manga_service(
            MangaService(service_id=DummyScraper2.ID, title_id=self.get_str_id(), title=title),
            add_manga=True
        )

        mangas = [
            MangaService(service_id=service_id, disabled=False,
                         title_id=self.get_str_id(),
                         manga_id=None, title=title.lower())
        ]

        with self.conn.transaction():
            with self.conn.cursor() as cur:
                self.assertIsNone(mangas[0].manga_id)
                added = self.dbutil.add_new_manga_and_check_duplicate_titles(mangas, cur=cur)
                self.assertTrue(added)

                self.assertEqual(added[0].manga_id, manga.manga_id)
                self.assertEqual(added, list(MangaServiceWithId.from_manga_services(mangas)))

    def test_add_new_manga(self):
        service_id = DummyScraper.ID

        mangas = [
            MangaService(service_id=service_id, disabled=False,
                         title_id=self.get_str_id(),
                         manga_id=None, title=self.get_str_id()),
            MangaService(service_id=service_id, disabled=False,
                         title_id=self.get_str_id(),
                         manga_id=None, title=self.get_str_id()),
            MangaService(service_id=service_id, disabled=False,
                         title_id=self.get_str_id(),
                         manga_id=None, title=self.get_str_id()),
            MangaService(service_id=service_id, disabled=False,
                         title_id=self.get_str_id(),
                         manga_id=None, title=self.get_str_id()),
        ]

        with self.conn.transaction():
            with self.conn.cursor() as cur:
                retval = self.dbutil.add_new_manga_and_check_duplicate_titles(mangas, cur=cur)

                self.assertListEqual(retval, list(MangaServiceWithId.from_manga_services(mangas)))
                self.assertNotIn(None, map(lambda ms: ms.manga_id, mangas))

    def test_get_service_manga_returns_nothing_with_invalid_id(self):
        self.assertFalse(self.dbutil.get_service_manga(-1))

    def test_get_service_manga_returns_added_manga(self):
        mangas = [
            MangaService(service_id=DummyScraper.ID, title_id=self.get_str_id(), title='test', last_check=self.utcnow()),
            MangaService(service_id=DummyScraper.ID, title_id=self.get_str_id(), title='test2', last_check=self.utcnow()),
        ]

        self.dbutil.add_new_mangas(mangas)
        self.dbutil.add_manga_services(mangas)

        retval = self.dbutil.get_service_manga(DummyScraper.ID)

        for manga in mangas:
            self.assertIn(MangaServicePartial.from_manga_service(manga), retval)


class TestDbUtil(BaseDbutilTest):
    def test_update_latest_chapter(self):
        # Must be run in utc, or otherwise daylight savings might affect the results
        # in some regions
        self.conn.execute("SET TIME ZONE 'UTC'")
        with self._conn.cursor() as cur:
            cur = spy_on(cur)
            self.dbutil.update_latest_chapter([], cur=cur)
            cur.execute.assert_not_called()  # type: ignore[union-attr]

        # Changing these will affect the test
        manga_ids = [
            (1, 5, datetime.fromisoformat('2020-08-02 16:00:00.000000').replace(tzinfo=timezone.utc)),
            (2, 2, datetime.fromisoformat('2020-08-02 16:00:00.000000').replace(tzinfo=timezone.utc)),
            (3, 52, datetime.fromisoformat('2020-01-02 16:00:00.000000').replace(tzinfo=timezone.utc))
        ]

        with self._conn.cursor() as cur:
            cur.execute('SELECT estimated_release FROM manga WHERE manga_id=%s', (manga_ids[0][0],))
            original_no_update = cur.fetchone()
            assert original_no_update is not None

        with self._conn.transaction():
            with self._conn.cursor() as cur:
                self.dbutil.update_latest_chapter(manga_ids, cur=cur)

        f = ','.join(['%s' for _ in manga_ids])
        sql = f'SELECT * FROM manga WHERE manga_id IN ({f})'
        with self._conn.cursor() as cur:
            cur.execute(sql, [m[0] for m in manga_ids])
            rows = cur.fetchall()

        no_update = next(filter(lambda r: r['manga_id'] == manga_ids[0][0], rows))
        assert no_update is not None
        self.assertNotEqual(no_update['latest_chapter'], manga_ids[0][1])
        self.assertDatesEqual(no_update['estimated_release'], original_no_update['estimated_release'])

        update_single = next(filter(lambda r: r['manga_id'] == manga_ids[1][0], rows))
        self.assertEqual(update_single['latest_chapter'], manga_ids[1][1])
        self.assertDatesEqual(update_single['estimated_release'], manga_ids[1][2] + update_single['release_interval'])

        update_multiple = next(filter(lambda r: r['manga_id'] == manga_ids[2][0], rows))
        self.assertEqual(update_multiple['latest_chapter'], manga_ids[2][1])
        self.assertDatesEqual(update_multiple['estimated_release'], manga_ids[2][2] + update_multiple['release_interval'])

    def test_update_estimated_release(self):
        with self._conn.transaction():
            with self._conn.cursor() as cur:
                self.assertIsNone(self.dbutil.update_estimated_release(-1, cur=cur))
                self.assertLogs('maintenance', 'WARNING')
                self.assertEqual(cur.rowcount, 0)

                manga_id = 1
                release = utcnow()

                sql = 'INSERT INTO chapters ' \
                      '(manga_id, service_id, title, chapter_number, chapter_decimal, chapter_identifier, release_date, group_id) ' \
                      'VALUES (%s, %s, %s, %s, %s, %s, %s, %s)'
                cur.execute(sql, (manga_id, DummyScraper.ID, 'test title',
                                  999, 5, '123456789987654321', release, NO_GROUP))

                row = self.dbutil.update_estimated_release(manga_id, cur=cur)
                self.assertIsNotNone(row)
                assert row is not None
                self.assertEqual(cur.rowcount, 1)
                self.assertLogs('maintenance', 'INFO')
                self.assertDatesNotEqual(row['estimated_release_old'], row['estimated_release'])
                self.assertDateGreater(row['estimated_release'], release)

    def test_set_service_disabled_until(self):
        with self.conn.transaction():
            with self.conn.cursor() as cur:
                disabled_until = utcnow() + timedelta(hours=12)
                service_id = 1
                self.dbutil.set_service_disabled_until(service_id,
                                                       disabled_until,
                                                       cur=cur)

                service = self.dbutil.get_service(service_id, cur=cur)
                assert service is not None
                self.assertDatesEqual(disabled_until, service.disabled_until)

    def test_update_service_whole(self):
        with self.conn.transaction():
            with self.conn.cursor() as cur:
                service_id = 2
                update_interval = timedelta(hours=2)
                now = utcnow()

                self.dbutil.update_service_whole(service_id, update_interval, cur=cur)

                service = self.dbutil.get_service(service_id)
                service_whole = self.dbutil.get_service_whole(service_id)

                self.assertIsNotNone(service, 'Service is None')
                self.assertIsNotNone(service_whole, 'Service whole is None')
                assert service is not None and service_whole is not None

                self.assertDatesAlmostEqual(service.last_check, now)
                self.assertDatesAlmostEqual(service_whole.last_check, now)
                self.assertDatesAlmostEqual(service_whole.next_update, now + update_interval)


class TestGetService(BaseDbutilTest):
    @staticmethod
    def get_service_obj() -> Service:
        return Service(service_id=DummyScraper.ID, service_name=DummyScraper.NAME,
                       url=DummyScraper.URL,
                       chapter_url_format=DummyScraper.CHAPTER_URL_FORMAT,
                       manga_url_format=DummyScraper.MANGA_URL_FORMAT,
                       disabled_until=None, last_check=None)

    def test_with_id(self):
        service = self.dbutil.get_service(DummyScraper.ID)
        self.assertEqual(service, self.get_service_obj())

    def test_with_url(self):
        service = self.dbutil.get_service(DummyScraper.URL)
        self.assertEqual(service, self.get_service_obj())


class TestUpdateInterval(BaseDbutilTest):
    def test_without_chapters(self):
        self.assertFalse(self.dbutil.update_chapter_interval(-1))

    def setup_manga(self) -> MangaServiceWithId:
        m = self.get_manga_service(DummyScraper)
        self.dbutil.add_manga_service(m, add_manga=True)

        ms_with_id = MangaServiceWithId.from_manga_service(m)

        self.assertFalse(self.dbutil.update_chapter_interval(ms_with_id.manga_id))

        return ms_with_id

    def get_chapter(self, m: MangaService, chapter_number: int, release_date: datetime | None = None) -> ChapterModel:
        id_ = self.get_str_id()

        return ChapterModel(
            manga_id=m.manga_id,
            service_id=m.service_id,
            title=f'{id_}_chapter',
            chapter_identifier=id_,
            chapter_number=chapter_number,
            release_date=release_date or utcnow(),
            group_id=NO_GROUP
        )

    def test_with_under_three_chapters(self):
        m = self.setup_manga()

        chapter_number = 0

        def get_chapter() -> ChapterModel:
            nonlocal chapter_number
            chapter_number += 1

            return self.get_chapter(m, chapter_number)

        # Should do nothing with a single chapter
        self.dbutil.add_chapters([get_chapter()])
        self.assertFalse(self.dbutil.update_chapter_interval(m.manga_id))

        # Should do nothing with 2 chapters
        self.dbutil.add_chapters([get_chapter()])
        self.assertFalse(self.dbutil.update_chapter_interval(m.manga_id))

        self.assertIsNone(
            self.get_manga_db(manga_id=m.manga_id).release_interval
        )

    def test_with_large_chapter_gaps(self):
        m = self.setup_manga()

        chapter_number = 0

        def get_chapter() -> ChapterModel:
            nonlocal chapter_number
            chapter_number += 3

            return self.get_chapter(m, chapter_number)

        self.dbutil.add_chapters([get_chapter() for _ in range(10)])

        # Make sure manga was not updated
        self.assertFalse(self.dbutil.update_chapter_interval(m.manga_id))
        self.assertIsNone(
            self.get_manga_db(manga_id=m.manga_id).release_interval
        )

    def test_with_same_chapter_number(self):
        m = self.setup_manga()

        chapter_number = 1

        def get_chapter(decimal: int | None = None) -> ChapterModel:
            chapter = self.get_chapter(m, chapter_number)
            chapter.chapter_decimal = decimal

            return chapter

        self.dbutil.add_chapters([
            get_chapter(),
            get_chapter(),
            get_chapter(),
            get_chapter(1),
            get_chapter(2),
            get_chapter(3)
        ])

        # Make sure manga was not updated
        self.assertFalse(self.dbutil.update_chapter_interval(m.manga_id))
        self.assertIsNone(
            self.get_manga_db(manga_id=m.manga_id).release_interval
        )

    def test_with_small_interval(self):
        m = self.setup_manga()

        chapter_number = 0

        def get_chapter() -> ChapterModel:
            nonlocal chapter_number
            chapter_number += 1
            return self.get_chapter(m, chapter_number)

        self.dbutil.add_chapters([get_chapter() for _ in range(10)])

        # Make sure manga was not updated
        self.assertFalse(self.dbutil.update_chapter_interval(m.manga_id))
        self.assertIsNone(
            self.get_manga_db(manga_id=m.manga_id).release_interval
        )

    def test_with_valid_interval(self):
        m = self.setup_manga()

        chapter_number = 0
        interval = timedelta(days=7)
        t = utcnow()

        def get_chapter() -> ChapterModel:
            nonlocal chapter_number, t
            chapter_number += 1
            t += interval
            return self.get_chapter(m, chapter_number, t)

        self.dbutil.add_chapters([get_chapter() for _ in range(10)])

        # Make sure manga was updated
        self.assertTrue(self.dbutil.update_chapter_interval(m.manga_id))
        self.assertEqual(
            self.get_manga_db(manga_id=m.manga_id).release_interval,
            interval
        )

    def test_with_some_close_interval(self):
        m = self.setup_manga()

        chapter_number = 0
        interval = timedelta(days=7)
        t = utcnow()

        def get_chapter(add_interval: bool = True) -> ChapterModel:
            nonlocal chapter_number, t
            chapter_number += 1
            if add_interval:
                t += interval
            return self.get_chapter(m, chapter_number, t)

        chapters = [
            get_chapter(),
            get_chapter(),
            get_chapter(False),
            get_chapter(False),
            get_chapter(False),
            get_chapter(),
            get_chapter(),
            get_chapter(),
            get_chapter()
        ]
        self.dbutil.add_chapters(chapters)

        # Make sure manga was updated
        self.assertTrue(self.dbutil.update_chapter_interval(m.manga_id))
        self.assertEqual(
            self.get_manga_db(m.manga_id).release_interval,
            interval
        )

    def test_median_used_when_mode_fails(self):
        m = self.setup_manga()

        chapter_number = 0
        interval = timedelta(days=7)
        t = utcnow()
        intervals = []

        def get_chapter() -> ChapterModel:
            nonlocal chapter_number, t, interval
            chapter_number += 1
            t += interval
            interval += timedelta(hours=8)
            intervals.append(interval.total_seconds())

            return self.get_chapter(m, chapter_number, t)

        self.dbutil.add_chapters([get_chapter() for _ in range(10)])

        # remove last interval as it's not used
        intervals.pop(-1)

        # Make sure manga was updated
        self.assertTrue(self.dbutil.update_chapter_interval(m.manga_id))
        self.assertEqual(
            self.get_manga_db(m.manga_id).release_interval,
            timedelta(seconds=statistics.median(intervals))
        )

    def test_decimals_ignored(self) -> None:
        m = self.setup_manga()

        chapter_number = 0
        decimal: int | None = None
        interval = timedelta(days=7)
        t = utcnow()

        def get_chapter() -> ChapterModel:
            nonlocal chapter_number, t, interval, decimal
            chapter_number += 1
            t += interval

            chapter = self.get_chapter(m, chapter_number, t)
            if decimal:
                chapter.chapter_decimal = decimal
                decimal = None
            else:
                decimal = 5

            return chapter

        self.dbutil.add_chapters([get_chapter() for _ in range(10)])

        # Make sure manga was updated
        self.assertTrue(self.dbutil.update_chapter_interval(m.manga_id))
        self.assertEqual(
            self.get_manga_db(m.manga_id).release_interval,
            interval*2
        )

    def test_gets_minimum_release_dates(self):
        m = self.setup_manga()

        chapter_number = 0
        duplicate = False
        interval = timedelta(days=7)
        t = utcnow()

        def get_chapter() -> ChapterModel:
            nonlocal chapter_number, t, interval, duplicate
            if duplicate:
                dt = t + interval*3
            else:
                chapter_number += 1
                t += interval
                dt = t

            duplicate = not duplicate

            chapter = self.get_chapter(m, chapter_number, dt)
            return chapter

        self.dbutil.add_chapters([get_chapter() for _ in range(10)])

        # Make sure manga was updated
        self.assertTrue(self.dbutil.update_chapter_interval(m.manga_id or -1))
        self.assertEqual(
            self.get_manga_db(m.manga_id).release_interval,
            interval
        )


class TestUpdateMangaTitle(BaseDbutilTest):
    def gen_title(self) -> str:
        return f'{self.get_str_id()}_manga'

    def create_manga(self, title: str | None = None) -> MangaWithId:
        ms = Manga(title=title or self.gen_title())
        return MangaWithId.model_validate(self.dbutil.add_new_manga(ms).model_dump())

    def get_manga_aliases(self, manga_id: int) -> list[str]:
        sql = 'SELECT title FROM manga_alias WHERE manga_id=%s'
        return [row['title'] for row in self.dbutil.execute(sql, (manga_id,))]

    def create_manga_alias(self, manga_id: int, alias: str) -> None:
        sql = 'INSERT INTO manga_alias (manga_id, title) VALUES (%s, %s)'
        self.dbutil.execute(sql, (manga_id, alias))

    def test_without_data(self):
        self.assertIsNone(self.dbutil.update_manga_titles([]))

    def test_with_all_new_titles(self):
        # Create manga and titles
        m1 = self.create_manga()
        m2 = self.create_manga()

        new_title1 = self.gen_title()
        new_title2 = self.gen_title()

        # Do update
        self.dbutil.update_manga_titles([
            (m1.manga_id, new_title1),
            (m2.manga_id, new_title2)
        ])

        # Assert correct changes
        self.assertEqual(
            self.get_manga_db(m1.manga_id).title,
            new_title1
        )
        self.assertEqual(
            self.get_manga_db(m2.manga_id).title,
            new_title2
        )

        self.assertEqual(
            self.get_manga_aliases(m1.manga_id),
            [m1.title]
        )
        self.assertEqual(
            self.get_manga_aliases(m2.manga_id),
            [m2.title]
        )

    def test_with_new_and_duplicate_titles(self):
        # Create manga and titles
        m1 = self.create_manga()
        m2 = self.create_manga()

        new_title1 = self.gen_title()
        old_title2 = m2.title

        # Do update
        self.dbutil.update_manga_titles([
            (m1.manga_id, new_title1),
            (m2.manga_id, old_title2)
        ])

        # Assert correct changes
        self.assertEqual(
            self.get_manga_db(m1.manga_id).title,
            new_title1
        )
        self.assertEqual(
            self.get_manga_db(m2.manga_id).title,
            old_title2
        )

        self.assertEqual(
            self.get_manga_aliases(m1.manga_id),
            [m1.title]
        )
        self.assertFalse(self.get_manga_aliases(m2.manga_id),
                         'Manga alias list should have been empty')

    def test_with_existing_alias(self):
        # Create manga and titles
        m1 = self.create_manga()
        m2 = self.create_manga()
        self.create_manga_alias(m2.manga_id, m2.title)

        new_title1 = self.gen_title()
        new_title2 = self.gen_title()

        # Do update
        self.dbutil.update_manga_titles([
            (m1.manga_id, new_title1),
            (m2.manga_id, new_title2)
        ])

        # Assert correct changes
        self.assertEqual(
            self.get_manga_db(m1.manga_id).title,
            new_title1
        )
        self.assertEqual(
            self.get_manga_db(m2.manga_id).title,
            new_title2
        )

        self.assertEqual(
            self.get_manga_aliases(m1.manga_id),
            [m1.title]
        )
        self.assertEqual(
            self.get_manga_aliases(m2.manga_id),
            [m2.title]
        )


if __name__ == '__main__':
    unittest.main()
