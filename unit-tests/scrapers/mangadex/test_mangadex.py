import os
import pickle
import unittest

import feedparser

from src.scrapers.mangadex import MangaDex, Chapter


class MyTestCase(unittest.TestCase):

    @staticmethod
    def parse_testfile():
        p = os.path.join(os.path.dirname(__file__), 'feed.xml')
        mangadex = MangaDex(None, None)
        return mangadex.parse_feed(feedparser.parse(p).entries, return_list=True)

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


if __name__ == '__main__':
    unittest.main()
