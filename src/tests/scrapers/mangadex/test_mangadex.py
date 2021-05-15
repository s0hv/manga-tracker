import json
import os
import pickle
import unittest
from typing import Tuple, Dict
from unittest.mock import MagicMock
from unittest.mock import patch

import feedparser
import requests
import responses

import setup_logging
from src.scrapers.mangadex import MangaDex, Chapter
from src.tests.testing_utils import mock_feedparse, BaseTestClasses

test_feed = os.path.join(os.path.dirname(__file__), 'feed.xml')
logger = setup_logging.setup()


class MangadexTests(BaseTestClasses.DatabaseTestCase):
    api_data: Dict = NotImplemented
    api_data_bytes: bytes = NotImplemented

    @classmethod
    def setUpClass(cls) -> None:
        super(MangadexTests, cls).setUpClass()

        api_path = os.path.join(os.path.dirname(__file__), 'api_data.json')
        with open(api_path, encoding='utf-8') as f:
            cls.api_data = json.load(f)

        with open(api_path, 'rb') as f:
            cls.api_data_bytes = f.read()

    def setUp(self) -> None:
        super().setUp()
        self.mangadex = MangaDex(self._conn, self.dbutil)

    @staticmethod
    def get_api_url() -> Tuple[str, str]:
        data = MangadexTests.api_data['data']['manga']
        title_id = str(data['id'])
        return f'{MangaDex.MANGADEX_API}/manga/{title_id}?include=chapters', title_id

    @staticmethod
    def parse_testfile():
        return MangaDex.parse_feed(feedparser.parse(test_feed).entries)

    @staticmethod
    def read_test_data():
        p = os.path.join(os.path.dirname(__file__), 'data.pickle')
        with open(p, 'rb') as f:
            return pickle.load(f)

    def chapters_equal(self, a: Chapter, b):
        self.assertEqual(a.title, b.title, "Title don't match")
        self.assertEqual(a.decimal, b.decimal, "Chapter decimal doesn't match")
        self.assertEqual(a.chapter_number, b.chapter_number, "Chapter number doesn't match")
        self.assertEqual(a.release_date, b.release_date, "Release date doesn't match")
        self.assertEqual(a.chapter_identifier, b.chapter_identifier, "Chapter identifier doesn't match")
        self.assertEqual(a.title_id, b.title_id, "Title id doesn't match")
        self.assertEqual(a.manga_title, b.manga_title, "Manga title doesn't match")
        self.assertEqual(a.manga_url, b.manga_url, "Manga url doesn't match")
        self.assertEqual(a.chapter_title, b.chapter_title, "Chapter title doesn't match")
        self.assertEqual(a.group, b.group, "Group doesn't match")
        self.assertEqual(a.volume, b.volume, "Volume doesn't match")

    def export_test_data(self):
        chapters = self.parse_testfile()
        p = os.path.join(os.path.dirname(__file__), 'data.pickle')
        with open(p, 'wb') as f:
            pickle.dump(chapters, f)

    def test_parser(self):
        chapters = self.parse_testfile()
        old_chapters = self.read_test_data()
        self.assertEqual(len(chapters), len(old_chapters))

        for a, b in zip(chapters, old_chapters):
            self.chapters_equal(a, b)

    @patch('feedparser.parse', wraps=mock_feedparse(test_feed))
    @patch.object(MangaDex, 'update_chapter_infos', lambda *_, **__: None)
    def test_parse_feed(self, parse: MagicMock):
        with self._conn:
            updated = self.mangadex.scrape_service(MangaDex.ID, 'test_feed', None)
        parse.assert_called_once()
        parse.assert_called_with('test_feed')
        self.assertIsNotNone(updated)
        self.assertGreater(len(updated), 0)

        with self._conn:
            # Parse feed again to make sure it works with duplicate inputs
            updated = self.mangadex.scrape_service(MangaDex.ID, 'test_feed', None)
        self.assertEqual(parse.call_count, 2)
        self.assertIsNone(updated)

    @patch('feedparser.parse', wraps=mock_feedparse('invalid_feed'))
    @patch.object(MangaDex, 'update_chapter_infos', lambda *_, **__: None)
    def test_parse_invalid_feed(self, parse: MagicMock):
        updated = self.mangadex.scrape_service(MangaDex.ID, 'invalid_feed', None)
        parse.assert_called_once()
        parse.assert_called_with('invalid_feed')
        self.assertIsNone(updated)

    @responses.activate
    def test_scrape_series(self):
        data = self.api_data['data']['manga']
        url, title_id = self.get_api_url()

        responses.add(responses.GET, url,
                      body=self.api_data_bytes)
        chapter_count = 3

        self.assertTrue(self.mangadex.scrape_series(title_id, MangaDex.ID, None))

        self.assertGreater(len(responses.calls), 0)

        manga = self.dbutil.get_manga_service(MangaDex.ID, title_id)
        self.assertIsNotNone(manga)

        chapters = self.dbutil.get_chapters(manga.manga_id, MangaDex.ID)
        self.assertEqual(len(chapters), chapter_count)

        self.assertEqual(manga.title, data['title'])

    @responses.activate
    def test_scrape_service_http_error(self):
        url, title_id = self.get_api_url()
        responses.add(responses.GET, url, body=requests.HTTPError())

        self.assertIsNone(self.mangadex.scrape_series(title_id, MangaDex.ID, None))
        self.assertEqual(len(responses.calls), 1)

    @responses.activate
    def test_scrape_service_data_error(self):
        url, title_id = self.get_api_url()
        body = b'{}'

        responses.add(responses.GET, url, body=body)

        self.assertIsNone(self.mangadex.scrape_series(title_id, MangaDex.ID, None))
        self.assertEqual(len(responses.calls), 1)


if __name__ == '__main__':
    unittest.main()
