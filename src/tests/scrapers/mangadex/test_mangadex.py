import os
import pickle
import unittest
from unittest.mock import patch
from unittest.mock import MagicMock

import feedparser

from src.scrapers.mangadex import MangaDex, Chapter
import setup_logging

from src.tests.testing_utils import get_conn, mock_feedparse, spy_on
from src.utils.dbutils import DbUtil

test_feed = os.path.join(os.path.dirname(__file__), 'feed.xml')
logger = setup_logging.setup()


class MangadexTests(unittest.TestCase):

    def setUp(self) -> None:
        self._conn = get_conn()
        self.dbutil = spy_on(DbUtil(self._conn))
        self.mangadex = MangaDex(self._conn, self.dbutil)

    def tearDown(self) -> None:
        self._conn.close()

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


if __name__ == '__main__':
    unittest.main()
