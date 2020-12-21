import unittest
import os
from datetime import datetime, timedelta, date

import responses

import setup_logging
from src.tests.testing_utils import BaseTestClasses
from src.scrapers.comixology import ComiXology
from src.scrapers.kodansha import Manga, Source, BaseManga


test_site = os.path.join(os.path.dirname(__file__), 'test_chapters_page.html')
test_chapter_site = os.path.join(os.path.dirname(__file__), 'test_chapter.html')

logger = setup_logging.setup()


class MockSrcElement:
    def __init__(self, href):
        self.attrib = {
            'href': href
        }


class MockManga(Manga):
    def __init__(self, manga_id, title, release_interval, title_id, latest_chapter, author):
        BaseManga.__init__(
            self,
            manga_id=manga_id,
            title=title,
            release_interval=release_interval,
            title_id=title_id,
            latest_chapter=latest_chapter,
            service_id=-1,
            disabled=False,
        )

        self.sources = []
        self.release_date = datetime.utcnow()
        self.chapter_decimal = None
        self.author = author


class TestComiXologyScraper(BaseTestClasses.DatabaseTestCase):
    def setUp(self) -> None:
        super(TestComiXologyScraper, self).setUp()

        ComiXology(self.conn, self.dbutil).add_service()

    @staticmethod
    def read_test_site():
        with open(test_site, 'r', encoding='utf-8') as f:
            return f.read()

    @staticmethod
    def read_test_chapter():
        with open(test_chapter_site, 'r', encoding='utf-8') as f:
            return f.read()

    @responses.activate
    def test_scrape_chapters(self):
        # Mock request
        test_url = 'https://www.comixologytest.com'
        responses.add(responses.GET, test_url, body=self.read_test_site())

        test_chapter_url = 'https://www.comixology.com/Attack-on-Titan-135/digital-comic/905253'
        responses.add(responses.GET, test_chapter_url, body=self.read_test_chapter())

        title_id = 'attack-on-titan'
        title = 'Attack on titan'
        latest_chapter = 135
        manga_id = self.dbutil.add_single_series(ComiXology.ID, title_id, title)
        manga = MockManga(manga_id, title, timedelta(days=30), title_id, latest_chapter, 'Test')

        source = Source(MockSrcElement(test_url), manga)

        comixology = ComiXology(self.conn, self.dbutil)
        updated = comixology.update_selected_manga((source, ))
        self.assertEqual(updated, 1, msg='Exactly one manga not updated')

        latest = self.dbutil.get_newest_chapter(manga_id, ComiXology.ID)

        # Make sure information is correct for latest chapter
        self.assertEqual(latest_chapter, latest['chapter_number'], msg='Latest chapters did not match')
        self.assertEqual(date(2020, 12, 8), latest['release_date'].date(), msg='Release date did not match')

        updated = comixology.update_selected_manga((source,))
        self.assertEqual(updated, 0, msg='Manga updated multiple times for same input')


if __name__ == '__main__':
    unittest.main()
