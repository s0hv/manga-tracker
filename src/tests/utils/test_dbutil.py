import unittest
from datetime import datetime, timedelta
from types import GeneratorType

from src.db.models.manga import MangaService
from src.tests.scrapers.testing_scraper import DummyScraper
from src.tests.testing_utils import Chapter, BaseTestClasses, spy_on


testing_series = {
    'test_manga_1': [
        Chapter(
            chapter_title='test 1',
            chapter_number=1,
            volume=1,
            release_date=datetime.utcnow(),
            chapter_identifier='test_id_1_1',
            title_id='test_manga_1',
            manga_title='test manga 1'
        ),
        Chapter(
            chapter_title='test 2.5',
            chapter_number=2,
            decimal=5,
            volume=1,
            release_date=datetime.utcnow(),
            chapter_identifier='test_id_1_2.5',
            title_id='test_manga_1',
            manga_title='test manga 1',
            group='test group 2'
        ),
        Chapter(
            chapter_title='test 1 no vol',
            chapter_number=1,
            release_date=datetime.utcnow(),
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
            release_date=datetime.utcnow(),
            chapter_identifier='test_id_2_1',
            title_id='test_manga_2',
            manga_title='test manga 2'
        ),
        Chapter(
            chapter_title='abc 2.5',
            chapter_number=2,
            decimal=2,
            volume=1,
            release_date=datetime.utcnow(),
            chapter_identifier='test_id_2_2.5',
            title_id='test_manga_2',
            manga_title='test manga 2'
        ),
        Chapter(
            chapter_title='abc 1 no vol',
            chapter_number=1,
            volume=0,
            release_date=datetime.utcnow(),
            chapter_identifier='test_id_2_1_alt',
            title_id='test_manga_2',
            manga_title='test manga 2',
            manga_url='abc',
            group='test group'
        )
    ]
}


class TestDbUtil(BaseTestClasses.DatabaseTestCase):
    def setUp(self) -> None:
        super().setUp()

        self.test_scraper = DummyScraper(self._conn, self.dbutil)
        self._id = 0

    def get_str_id(self) -> str:
        self._id += 1
        return f'{__name__}_{self._id}'

    def test_add_new_series_and_chapters(self):
        """
        Tests that new manga and chapters are added correctly
        """
        new_chapters = []
        new_manga = []
        with self._conn:
            with self._conn.cursor() as cur:
                retval = self.dbutil.add_new_series(cur, testing_series, DummyScraper.ID)
                self.assertIsInstance(retval, GeneratorType)
                for manga_id, chapters in retval:
                    new_chapters.extend(chapters)
                    new_manga.append((manga_id, chapters))

                    self.dbutil.add_chapters(
                        cur, manga_id, DummyScraper.ID, chapters
                    )

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
            self.assertEqual(c.manga_title, manga['title'])
            self.assertEqual(c.title_id, manga['title_id'])
            self.assertFalse(manga['disabled'])

    def test_add_new_series_empty(self):
        with self._conn:
            with self._conn.cursor() as cur:
                retval = self.dbutil.add_new_series(cur, {}, DummyScraper.ID)
                self.assertIsInstance(retval, GeneratorType)
                self.assertEqual(len(list(retval)), 0)

    def test_update_latest_chapter(self):
        with self._conn.cursor() as cur:
            cur = spy_on(cur)
            self.dbutil.update_latest_chapter(cur, [])
            cur.execute.assert_not_called()

        # Changing these will affect the test
        manga_ids = [
            (1, 5, datetime.fromisoformat('2020-08-02 16:00:00.000000')),
            (2, 2, datetime.fromisoformat('2020-08-02 16:00:00.000000')),
            (3, 52, datetime.fromisoformat('2020-01-02 16:00:00.000000'))
        ]

        with self._conn.cursor() as cur:
            cur.execute('SELECT estimated_release FROM manga WHERE manga_id=%s', (manga_ids[0][0],))
            original_no_update = cur.fetchone()

        with self._conn:
            with self._conn.cursor() as cur:
                self.dbutil.update_latest_chapter(cur, manga_ids)

        f = ','.join(['%s' for _ in manga_ids])
        sql = f'SELECT * FROM manga WHERE manga_id IN ({f})'
        with self._conn.cursor() as cur:
            cur.execute(sql, [m[0] for m in manga_ids])
            rows = cur.fetchall()

        no_update = next(filter(lambda r: r['manga_id'] == manga_ids[0][0], rows))
        self.assertNotEqual(no_update['latest_chapter'], manga_ids[0][1])
        self.assertDatesEqual(no_update['estimated_release'], original_no_update['estimated_release'])

        update_single = next(filter(lambda r: r['manga_id'] == manga_ids[1][0], rows))
        self.assertEqual(update_single['latest_chapter'], manga_ids[1][1])
        self.assertDatesEqual(update_single['estimated_release'], manga_ids[1][2] + update_single['release_interval'])

        update_multiple = next(filter(lambda r: r['manga_id'] == manga_ids[2][0], rows))
        self.assertEqual(update_multiple['latest_chapter'], manga_ids[2][1])
        self.assertDatesEqual(update_multiple['estimated_release'], manga_ids[2][2] + update_multiple['release_interval'])

    def test_update_estimated_release(self):
        with self._conn:
            with self._conn.cursor() as cur:
                self.assertIsNone(self.dbutil.update_estimated_release(cur, None))
                self.assertLogs('maintenance', 'WARNING')
                self.assertEqual(cur.rowcount, 0)

                manga_id = 1
                release = datetime.utcnow()

                sql = 'INSERT INTO chapters ' \
                      '(manga_id, service_id, title, chapter_number, chapter_decimal, chapter_identifier, release_date) ' \
                      'VALUES (%s, %s, %s, %s, %s, %s, %s)'
                cur.execute(sql, (manga_id, DummyScraper.ID, 'test title',
                                  999, 5, '123456789987654321', release))

                row = self.dbutil.update_estimated_release(cur, manga_id)
                self.assertIsNotNone(row)
                self.assertEqual(cur.rowcount, 1)
                self.assertLogs('maintenance', 'INFO')
                self.assertDatesNotEqual(row['estimated_release_old'], row['estimated_release'])
                self.assertDateGreater(row['estimated_release'], release)

    def test_set_service_disabled_until(self):
        with self.conn:
            with self.conn.cursor() as cur:
                disabled_until = datetime.utcnow() + timedelta(hours=12)
                service_id = 1
                self.dbutil.set_service_disabled_until(cur, service_id,
                                                       disabled_until)

                service = self.dbutil.get_service(cur, service_id)

                self.assertDatesEqual(disabled_until, service.disabled_until)

    def test_update_service_whole(self):
        with self.conn:
            with self.conn.cursor() as cur:
                service_id = 2
                update_interval = timedelta(hours=2)
                now = datetime.utcnow()

                self.dbutil.update_service_whole(cur, service_id, update_interval)

                service = self.dbutil.get_service(service_id)
                service_whole = self.dbutil.get_service_whole(service_id)

                self.assertIsNotNone(service, 'Service is None')
                self.assertIsNotNone(service_whole, 'Service whole is None')

                self.assertDatesAlmostEqual(service.last_check, now)
                self.assertDatesAlmostEqual(service_whole.last_check, now)
                self.assertDatesAlmostEqual(service_whole.next_update, now + update_interval)

    def test_add_new_manga_with_only_duplicates(self):
        service_id = 1
        mangas = [
            MangaService(service_id, False, 'test1',
                         manga_id=None, title='test 1'),
            MangaService(service_id, False, 'test2',
                         manga_id=None, title='test 1')
        ]

        with self.conn:
            with self.conn.cursor() as cur:
                cur = spy_on(cur)
                self.assertIsNone(self.dbutil.add_new_manga(cur, service_id, mangas))
                cur.execute.assert_not_called()

    def test_add_new_manga_with_multiple_same_matches(self):
        service_id = 1
        title = 'Manga test'

        id1 = self.dbutil.add_single_series(service_id+1, self.get_str_id(), title)
        id2 = self.dbutil.add_single_series(service_id+1, self.get_str_id(), title)

        mangas = [
            MangaService(service_id, False, 'test_matches_1',
                         manga_id=None, title=title)
        ]

        with self.conn:
            with self.conn.cursor() as cur:
                retval = self.dbutil.add_new_manga(cur, service_id, mangas)
                self.assertListEqual(retval, mangas)

                self.assertNotIn(retval[0].manga_id, [id1, id2])

    def test_add_new_manga_with_same_input_titles(self):
        service_id = 1
        title = 'test'

        mangas = [
            MangaService(service_id, False, self.get_str_id(),
                         manga_id=None, title=title),
            MangaService(service_id, False, self.get_str_id(),
                         manga_id=None, title=title)
        ]

        with self.conn:
            with self.conn.cursor() as cur:
                cur = spy_on(cur)

                self.assertIsNone(self.dbutil.add_new_manga(cur, service_id, mangas))
                cur.execute.assert_not_called()

    def test_add_new_manga_with_existing_title(self):
        service_id = 1
        title = 'Very Unique Title'

        id1 = self.dbutil.add_single_series(service_id+1, self.get_str_id(), title)

        mangas = [
            MangaService(service_id, False, self.get_str_id(),
                         manga_id=None, title=title.lower())
        ]

        with self.conn:
            with self.conn.cursor() as cur:
                self.assertIsNone(mangas[0].manga_id)
                self.assertIsNone(self.dbutil.add_new_manga(cur, service_id, mangas))

                self.assertEqual(mangas[0].manga_id, id1)

    def test_add_new_manga(self):
        service_id = 1

        mangas = [
            MangaService(service_id, False, self.get_str_id(),
                         manga_id=None, title=self.get_str_id()),
            MangaService(service_id, False, self.get_str_id(),
                         manga_id=None, title=self.get_str_id()),
            MangaService(service_id, False, self.get_str_id(),
                         manga_id=None, title=self.get_str_id()),
            MangaService(service_id, False, self.get_str_id(),
                         manga_id=None, title=self.get_str_id())
        ]

        with self.conn:
            with self.conn.cursor() as cur:
                retval = self.dbutil.add_new_manga(cur, service_id, mangas)

                self.assertListEqual(retval, mangas)
                self.assertNotIn(None, map(lambda ms: ms.manga_id, mangas))


if __name__ == '__main__':
    unittest.main()
