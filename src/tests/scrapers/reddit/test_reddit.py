import os
import unittest
from unittest.mock import patch, MagicMock

import feedparser

from src.constants import NO_GROUP
from src.db.models.manga import MangaService
from src.scrapers import Reddit
from src.tests.testing_utils import (BaseTestClasses, mock_feedparse,
                                     load_chapters_snapshot)

test_feed = os.path.join(os.path.dirname(__file__), 'test_data.xml')


class TestRedditScraper(BaseTestClasses.ModelAssertions, BaseTestClasses.DatabaseTestCase):
    @staticmethod
    def read_test_data():
        p = os.path.join(os.path.dirname(__file__), 'chapters.json')
        return load_chapters_snapshot(p)

    def test_feed_parsed_correctly(self):
        feed = feedparser.parse(test_feed)
        self.assertGreater(len(feed.entries), 0)
        chapters = Reddit.parse_feed(feed.entries, group_id=NO_GROUP)
        self.assertEqual(len(chapters), len(feed.entries))

        correct_chapters = self.read_test_data()
        self.assertEqual(len(chapters), len(correct_chapters))
        for a, b in zip(chapters, correct_chapters):
            self.assertChaptersEqual(a, b)

    @patch('feedparser.parse', wraps=mock_feedparse(test_feed))
    def test_parse_feed(self, parse: MagicMock):
        reddit = Reddit(self.conn, self.dbutil)
        feed_url = 'https://www.reddit.com/r/Test/search.rss?sort=new'
        manga_id = self.dbutil.add_manga_service(
            MangaService(service_id=Reddit.ID, title_id='RedditTest',
                         title='Reddit test manga', feed_url=feed_url),
            add_manga=True
        ).manga_id

        # Mypy fix
        if manga_id is None:
            self.assertIsNotNone(manga_id)
            return

        with self._conn.transaction():
            did_update = reddit.scrape_series('RedditTest', Reddit.ID, manga_id, feed_url)

        parse.assert_called_once()
        parse.assert_called_with(feed_url)
        self.assertIsNotNone(did_update)
        self.assertTrue(did_update)

        with self._conn.transaction():
            # Parse feed again to make sure it works with duplicate inputs
            did_update = reddit.scrape_series('TestTitleId', Reddit.ID, manga_id, feed_url)
        self.assertEqual(parse.call_count, 2)
        self.assertIsNotNone(did_update)
        self.assertFalse(did_update)


if __name__ == '__main__':
    unittest.main()
