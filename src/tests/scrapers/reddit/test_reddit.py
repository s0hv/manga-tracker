import pickle
import unittest
import os

import feedparser

import setup_logging
from src.scrapers import Reddit
from src.tests.testing_utils import BaseTestClasses


test_feed = os.path.join(os.path.dirname(__file__), 'test_data.xml')
logger = setup_logging.setup()


class TestRedditScraper(BaseTestClasses.ModelAssertions):
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


if __name__ == '__main__':
    unittest.main()
