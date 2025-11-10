import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import feedparser
import pytest

from src.constants import NO_GROUP
from src.db.models.manga import MangaService
from src.scrapers import Reddit
from src.tests.testing_utils import (
    BaseTestClasses,
    ChapterTestModel,
    load_chapters_snapshot,
    mock_feedparse,
)

test_feed = Path(__file__).parent / 'test_data.xml'


class TestRedditScraper(BaseTestClasses.ModelAssertions, BaseTestClasses.DatabaseTestCase):
    @staticmethod
    def read_test_data() -> list[ChapterTestModel]:
        p = Path(__file__).parent / 'chapters.json'
        return load_chapters_snapshot(p)

    def test_feed_parsed_correctly(self):
        feed = feedparser.parse(test_feed)
        assert len(feed.entries) > 0
        chapters = Reddit.parse_feed(feed.entries, group_id=NO_GROUP)
        assert len(chapters) == len(feed.entries)

        correct_chapters = self.read_test_data()
        assert len(chapters) == len(correct_chapters)
        for a, b in zip(chapters, correct_chapters, strict=True):
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
            assert manga_id is not None
            return

        with self._conn.transaction():
            did_update = reddit.scrape_series('RedditTest', Reddit.ID, manga_id, feed_url)

        parse.assert_called_once()
        parse.assert_called_with(feed_url)
        assert did_update is not None
        assert did_update

        with self._conn.transaction():
            # Parse feed again to make sure it works with duplicate inputs
            did_update = reddit.scrape_series('TestTitleId', Reddit.ID, manga_id, feed_url)
        assert parse.call_count == 2
        assert did_update is not None
        assert not did_update

    def test_scrape_service_without_feed_url_throws(self):
        with pytest.raises(ValueError, match='feed_url cannot be None'):
            Reddit(self.conn, self.dbutil).scrape_series('', 1, 1, None)


if __name__ == '__main__':
    unittest.main()
