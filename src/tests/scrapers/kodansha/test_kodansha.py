# type: ignore
import os
import pickle
import unittest
from typing import Iterable, Union

import pytest
import responses

pytest.skip('Kodansha not in use anymore.', allow_module_level=True)

from src.scrapers import ComiXology, SCRAPERS
from src.scrapers.kodansha import Manga, KodanshaComics
from src.tests.testing_utils import BaseTestClasses, spy_on
from src.tests.scrapers.testing_scraper import DummyScraper

test_site = os.path.join(os.path.dirname(__file__), 'test_data.html')


class DummyScraperForKodansha(DummyScraper):
    def update_selected_manga(self, manga_links: Iterable) -> Union[None, int, bool]:
        return None


class TestKodanshaScraper(BaseTestClasses.ModelAssertions, BaseTestClasses.DatabaseTestCase):
    def setUp(self) -> None:
        super(TestKodanshaScraper, self).setUp()
        KodanshaComics(self.conn, self.dbutil).add_service()

    @staticmethod
    def read_test_data():
        p = os.path.join(os.path.dirname(__file__), 'data.pickle')
        with open(p, 'rb') as f:
            return pickle.load(f)

    @staticmethod
    def read_test_site():
        with open(test_site, 'r', encoding='utf-8') as f:
            return f.read()

    def assertKodanshaMangaEqual(self, manga1: Manga, manga2: Manga):
        self.assertMangaServiceEqual(manga1, manga2)

        self.assertEqual(manga1.chapter_decimal, manga2.chapter_decimal)

        self.assertEqual(len(manga1.sources), len(manga2.sources))
        for s1, s2 in zip(manga1.sources, manga2.sources):
            self.assertEqual(s1.manga_url, s2.manga_url)
            self.assertEqual(s1.base_url, s2.base_url)

        #self.assertEqual(manga1.release_date, manga2.release_date)

    def test_site_parsed_correctly(self):
        mangas = KodanshaComics.parse_manga_from_html(self.read_test_site())
        self.assertIsNotNone(mangas)

        snapshot = self.read_test_data()
        for m1, m2 in zip(mangas, snapshot):
            self.assertKodanshaMangaEqual(m1, m2)

    @responses.activate
    def test_feed_parsed_correctly(self):
        # Mock request
        test_url = 'https://www.kodanshatest.com'
        responses.add(responses.GET, test_url, body=self.read_test_site())

        # Mock scrapers
        dummy = spy_on(DummyScraperForKodansha(self.conn, self.dbutil))

        def create_dummy(conn, dbutil):
            dummy._conn = conn
            dummy._dbutil = dbutil
            return dummy

        SCRAPERS[ComiXology.URL] = create_dummy

        # Manga title id
        title_id = 'attack-on-titan'

        dummy.update_selected_manga.return_value = 2

        kodansha = KodanshaComics(self.conn, self.dbutil)
        updated = kodansha.scrape_series(title_id, KodanshaComics.ID, None, feed_url=test_url)
        self.assertTrue(updated)
        self.assertMangaServiceExists(title_id, KodanshaComics.ID)
        self.assertEqual(dummy.update_selected_manga.call_count, 1, msg='Multiple manga were updated')

    @responses.activate
    def test_feed_updates_all(self):
        # Mock request
        test_url = 'https://www.kodanshatest.com'
        responses.add(responses.GET, test_url, body=self.read_test_site())

        # Mock scrapers
        dummy = spy_on(DummyScraperForKodansha(self.conn, self.dbutil))

        def create_dummy(conn, dbutil):
            dummy._conn = conn
            dummy._dbutil = dbutil
            return dummy

        SCRAPERS[ComiXology.URL] = create_dummy

        dummy.update_selected_manga.return_value = 2

        kodansha = KodanshaComics(self.conn, self.dbutil)
        updated = kodansha.scrape_service(KodanshaComics.ID, test_url, None)
        self.assertIsNotNone(updated)
        self.assertEqual(len(updated), 8, msg='Not enough manga were updated')
        self.assertEqual(dummy.update_selected_manga.call_count, 8, msg='More than 8 manga were updated')


if __name__ == '__main__':
    unittest.main()
