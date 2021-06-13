import os
import re
import unittest
from datetime import datetime
from typing import Any, Pattern

import requests
import responses
from lxml import etree

import setup_logging
from src.constants import NO_GROUP
from src.scrapers.comixology import ComiXology
from src.tests.testing_utils import BaseTestClasses, load_chapters_snapshot

base_path = os.path.dirname(__file__)
test_chapter_site = os.path.join(base_path, 'test_chapter.html')

page1_path = os.path.join(base_path, 'page1.html')
page2_path = os.path.join(base_path, 'page2.html')
manga_path = os.path.join(base_path, 'manga_page1.html')
manga_page_path = os.path.join(base_path, 'manga_page2.html')


logger = setup_logging.setup()


class TestComiXologyScraper(BaseTestClasses.DatabaseTestCase, BaseTestClasses.ModelAssertions):
    page1: str
    page2: str
    chapter_page: str

    manga_page: str
    manga_page2: str

    page1_url: str = ComiXology.FEED_URL
    page_n_url: Pattern = re.compile(r'https://www\.comixology\.com/site/list\?id=\w+&pageNum=\d+&pageLetter=null&cu=0')
    test_chapter_url: Pattern = re.compile(r'https://www\.comixology\.com/[\w-]+/digital-comic/\d+', re.I)

    @classmethod
    def setUpClass(cls) -> None:
        super(TestComiXologyScraper, cls).setUpClass()

        cls.page1 = cls.read_page1()
        cls.page2 = cls.read_page2()
        cls.chapter_page = cls.read_test_chapter()
        cls.manga_page = cls.read_test_manga()
        cls.manga_page2 = cls.read_test_manga_page()

    @staticmethod
    def read_page1():
        with open(page1_path, 'r', encoding='utf-8') as f:
            return f.read()

    @staticmethod
    def read_page2():
        with open(page2_path, 'r', encoding='utf-8') as f:
            return f.read()

    @staticmethod
    def read_test_chapter():
        with open(test_chapter_site, 'r', encoding='utf-8') as f:
            return f.read()

    @staticmethod
    def read_test_manga():
        with open(manga_path, 'r', encoding='utf-8') as f:
            return f.read()

    @staticmethod
    def read_test_manga_page():
        with open(manga_page_path, 'r', encoding='utf-8') as f:
            return f.read()

    def get_scraper(self) -> ComiXology:
        return ComiXology(self.conn, self.dbutil)

    def set_up_responses(self, page1: Any = None, page2: Any = None, chapter: Any = None):
        # Mock requests. Order matters
        responses.add(responses.GET, self.page_n_url, body=self.page2 if page2 is None else page2)
        responses.add(responses.GET, self.page1_url, body=self.page1 if page1 is None else page1)
        responses.add(responses.GET, self.test_chapter_url, body=self.chapter_page if chapter is None else chapter)

    def delete_chapters(self):
        """
        Deletes all chapters from ComiXology
        """
        with self.conn:
            with self.conn.cursor() as cur:
                cur.execute('DELETE FROM chapters WHERE service_id=%s', (ComiXology.ID,))

    @responses.activate
    def test_scrape_service_works(self):
        self.set_up_responses()

        scraper = self.get_scraper()
        self.delete_chapters()

        updated = scraper.scrape_service(ComiXology.ID, self.page1_url, None)

        # 2 requests for fetching pages and 6 requests for chapters
        self.assertEqual(len(responses.calls), 8)
        self.assertEqual(responses.calls[0].request.url, self.page1_url)
        self.assertRegexpMatches(responses.calls[1].request.url, self.page_n_url)

        self.assertEqual(len(updated), 6)

        # Make sure nothing is updated afterwards
        self.assertIsNone(scraper.scrape_service(ComiXology.ID, self.page1_url, None))

        # make sure manga titles are parsed correctly
        self.assertMangaWithTitleFound('Cardcaptor Sakura: Clear Card')

    @responses.activate
    def test_scrape_service_works_without_page_2(self):
        self.set_up_responses(page2=requests.RequestException())

        scraper = self.get_scraper()
        self.delete_chapters()
        updated = scraper.scrape_service(ComiXology.ID, self.page1_url, None)

        # 2 requests for fetching pages and 3 requests for chapters
        self.assertEqual(len(responses.calls), 5)
        self.assertEqual(responses.calls[0].request.url, self.page1_url)
        self.assertRegexpMatches(responses.calls[1].request.url, self.page_n_url)

        self.assertEqual(len(updated), 3)

    @responses.activate
    def test_does_nothing_when_request_error(self):
        self.set_up_responses(page1=requests.RequestException())

        scraper = self.get_scraper()
        updated = scraper.scrape_service(ComiXology.ID, self.page1_url, None)

        self.assertEqual(len(responses.calls), 1)
        self.assertEqual(responses.calls[0].request.url, self.page1_url)

        self.assertIsNone(updated)

    @responses.activate
    def test_get_chapter_release_date_with_error(self):
        self.set_up_responses(chapter=requests.HTTPError('fail'))

        scraper = self.get_scraper()
        url = 'https://www.comixology.com/test/digital-comic/42'
        retval = scraper.get_chapter_release_date(url)

        self.assertIsNone(retval)
        self.assertEqual(len(responses.calls), 1)
        self.assertEqual(responses.calls[0].request.url, url)

    @responses.activate
    def test_get_chapter_release_date_with_ratelimit_status(self):
        responses.add(responses.GET, self.test_chapter_url, body='', status=429)

        scraper = self.get_scraper()
        url = 'https://www.comixology.com/test/digital-comic/42'
        retval = scraper.get_chapter_release_date(url)

        self.assertIsNone(retval)
        self.assertEqual(len(responses.calls), 1)
        self.assertEqual(responses.calls[0].request.url, url)

    @responses.activate
    def test_get_chapter_release_date_with_bad_status_code(self):
        responses.add(responses.GET, self.test_chapter_url, body='', status=400)

        scraper = self.get_scraper()
        url = 'https://www.comixology.com/test/digital-comic/42'
        retval = scraper.get_chapter_release_date(url)

        self.assertIsNone(retval)
        self.assertEqual(len(responses.calls), 1)
        self.assertEqual(responses.calls[0].request.url, url)

    @responses.activate
    def test_get_chapter_release_date_valid(self):
        responses.add(responses.GET, self.test_chapter_url, body=self.chapter_page)

        scraper = self.get_scraper()
        url = 'https://www.comixology.com/test/digital-comic/42'
        retval = scraper.get_chapter_release_date(url)

        self.assertIsNotNone(retval)
        self.assertEqual(len(responses.calls), 1)
        self.assertEqual(responses.calls[0].request.url, url)
        self.assertEqual(retval, datetime(2020, 12, 8))

    def test_parse_chapters(self):
        root = etree.HTML(self.page1)
        chapter_elements = list(root.cssselect('li.content-item'))
        chapter_elements.extend(
            etree.HTML(self.page2).cssselect('li.content-item')
        )

        self.assertGreater(len(chapter_elements), 0)
        now = datetime.utcnow()
        parsed = ComiXology.parse_chapters(chapter_elements, NO_GROUP)

        loaded = load_chapters_snapshot(os.path.join(base_path, 'chapters.json'))

        self.assertGreater(len(loaded), 0)
        self.assertEqual(len(parsed), len(loaded))

        for c_parsed, c_loaded in zip(sorted(parsed), sorted(loaded)):
            self.assertChaptersEqual(c_parsed, c_loaded, ignore_date=True)
            self.assertGreater(c_parsed.release_date, now)

    @responses.activate
    def test_scrape_series(self):
        title_id = '56630'
        internal_id = '87a0d42b5500449205cca99bc8fd0ff395c9a84f'
        url = ComiXology.MANGA_URL_FORMAT.format(title_id)
        responses.add(responses.GET, url, body=self.manga_page)
        responses.add(responses.GET, ComiXology.PAGE_URL.format(id=internal_id, page=2), body=self.manga_page2)
        responses.add(responses.GET, self.page_n_url, status=400)
        responses.add(responses.GET, self.test_chapter_url, body=self.chapter_page)

        self.delete_chapters()
        scraper = self.get_scraper()

        success = scraper.scrape_series(title_id, ComiXology.ID, None)
        self.assertTrue(success)

        # 3 for fetching pages, 30 for fetching manga
        self.assertEqual(len(responses.calls), 33)

        manga = self.dbutil.get_manga_service(ComiXology.ID, title_id)
        self.assertIsNotNone(manga)

        # Make sure only 30 chapters were added
        chapters = self.dbutil.get_chapters(manga.manga_id, ComiXology.ID)
        self.assertEqual(len(chapters), 30)

        # Make sure rest of the chapters can be added
        success = scraper.scrape_series(title_id, ComiXology.ID, manga.manga_id)
        self.assertTrue(success)

        self.dbutil.get_chapters(manga.manga_id, ComiXology.ID)
        self.assertGreater(len(self.dbutil.get_chapters(manga.manga_id, ComiXology.ID)), 30)


if __name__ == '__main__':
    unittest.main()
