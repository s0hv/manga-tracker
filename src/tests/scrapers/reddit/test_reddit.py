import os
import pickle
import unittest
from unittest.mock import patch, MagicMock

import feedparser

import setup_logging
from src.db.models.manga import MangaService
from src.scrapers import Reddit
from src.tests.testing_utils import BaseTestClasses, mock_feedparse

test_feed = os.path.join(os.path.dirname(__file__), 'test_data.xml')
logger = setup_logging.setup()


class TestRedditScraper(BaseTestClasses.ModelAssertions, BaseTestClasses.DatabaseTestCase):
    def setUp(self) -> None:
        super(TestRedditScraper, self).setUp()
        Reddit(self.conn, self.dbutil).add_service()

    @staticmethod
    def read_test_data():
        p = os.path.join(os.path.dirname(__file__), 'data.pickle')
        with open(p, 'rb') as f:
            return pickle.load(f)

    def test_feed_parsed_correctly(self):
        feed = feedparser.parse(test_feed)
        self.assertGreater(len(feed.entries), 0)
        chapters = Reddit.parse_feed(feed.entries)
        self.assertEqual(len(chapters), len(feed.entries))

        correct_chapters = self.read_test_data()
        self.assertEqual(len(chapters), len(correct_chapters))
        for a, b in zip(chapters, correct_chapters):
            self.assertChaptersEqual(a, b)

    @patch('feedparser.parse', wraps=mock_feedparse(test_feed))
    def test_parse_feed(self, parse: MagicMock):
        reddit = Reddit(self._conn, self.dbutil)
        feed_url = 'reddit_test_feed'
        manga_id = self.dbutil.add_manga_service(
            MangaService(service_id=Reddit.ID, title_id='RedditTest',
                         title='Reddit test manga', feed_url=feed_url),
            add_manga=True
        ).manga_id

        # Mypy fix
        if manga_id is None:
            self.assertIsNotNone(manga_id)
            return

        with self._conn:
            did_update = reddit.scrape_series('RedditTest', Reddit.ID, manga_id, feed_url)

        parse.assert_called_once()
        parse.assert_called_with(feed_url)
        self.assertIsNotNone(did_update)
        self.assertTrue(did_update)

        with self._conn:
            # Parse feed again to make sure it works with duplicate inputs
            did_update = reddit.scrape_series('TestTitleId', Reddit.ID, manga_id, feed_url)
        self.assertEqual(parse.call_count, 2)
        self.assertIsNotNone(did_update)
        self.assertFalse(did_update)


if __name__ == '__main__':
    unittest.main()
