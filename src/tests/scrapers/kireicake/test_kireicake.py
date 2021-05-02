import os
import unittest
from datetime import datetime
from unittest.mock import MagicMock
from unittest.mock import patch

import feedparser

from src.scrapers.kireicake import KireiCake
from src.tests.testing_utils import mock_feedparse
from src.tests.utils.test_dbutil import BaseTestClasses

test_feed = os.path.join(os.path.dirname(__file__), 'feed.xml')


def get_date(s: str):
    return datetime.strptime(s, '%a, %d %b %Y %H:%M:%S %z')


# Entries that should be in feed.xml
correct_entries = {
    '10534': KireiCake.Chapter(
        chapter_identifier='10534',
        chapter_number='141',
        decimal='5',
        manga_title='The Duke of Death and his Black Maid',
        release_date=get_date('Mon, 01 Mar 2021 01:21:24 +0000'),
        title_id='the-duke-of-death-and-his-black-maid',
        chapter_title=None,
        group=KireiCake.NAME,
        manga_url=KireiCake.MANGA_URL_FORMAT.format('the-duke-of-death-and-his-black-maid')
    ),
    '10531': KireiCake.Chapter(
        chapter_identifier='10531',
        chapter_number='168',
        decimal=None,
        manga_title='The Duke of Death and his Black Maid',
        release_date=get_date('Sun, 28 Feb 2021 03:31:01 +0000'),
        title_id='the-duke-of-death-and-his-black-maid',
        chapter_title=None,
        group=KireiCake.NAME,
        manga_url=KireiCake.MANGA_URL_FORMAT.format('the-duke-of-death-and-his-black-maid')
    ),
    '10529': KireiCake.Chapter(
        chapter_identifier='10529',
        chapter_number='38',
        decimal=None,
        manga_title='Sister of the Woods',
        release_date=get_date('Sat, 27 Feb 2021 22:32:28 +0000'),
        title_id='sister-of-the-woods',
        chapter_title=None,
        group=KireiCake.NAME,
        manga_url=KireiCake.MANGA_URL_FORMAT.format('sister-of-the-woods')
    ),
    '10527': KireiCake.Chapter(
        chapter_identifier='10527',
        chapter_number='11',
        decimal='4',
        manga_title='Little Girl x Scoop x Evil Eye',
        release_date=get_date('Sat, 27 Feb 2021 19:28:25 +0000'),
        title_id='little-girl-x-scoop-x-evil-eye',
        chapter_title=None,
        group=KireiCake.NAME,
        manga_url=KireiCake.MANGA_URL_FORMAT.format('little-girl-x-scoop-x-evil-eye')
    ),
    '10503': KireiCake.Chapter(
        chapter_identifier='10503',
        chapter_number='23',
        decimal=None,
        manga_title='Former World Number 1',
        release_date=get_date('Sun, 14 Feb 2021 02:48:20 +0000'),
        title_id='former-world-number-1',
        chapter_title=None,
        group=KireiCake.NAME,
        manga_url=KireiCake.MANGA_URL_FORMAT.format('former-world-number-1')
    ),
    '10600': KireiCake.Chapter(
        chapter_identifier='10600',
        chapter_number='12',
        decimal='2',
        manga_title='Little Girl x Scoop x Evil Eye',
        release_date=get_date('Sun, 04 Apr 2021 20:41:39 +0000'),
        title_id='little-girl-x-scoop-x-evil-eye',
        chapter_title=None,
        group=KireiCake.NAME,
        manga_url=KireiCake.MANGA_URL_FORMAT.format('little-girl-x-scoop-x-evil-eye')
    )
}


class KireiCakeTest(BaseTestClasses.DatabaseTestCase):
    def setUp(self) -> None:
        super().setUp()
        KireiCake(self.conn, self.dbutil).add_service()

    def get_scraper(self) -> KireiCake:
        return KireiCake(self.conn, self.dbutil)

    def test_get_chapter_title_returns_none(self):
        kc = self.get_scraper()
        self.assertIsNone(kc.get_chapter_title({}))

    def test_get_chapter_id_returns_id(self):
        kc = self.get_scraper()
        chapter_id = '100'
        self.assertEqual(
            kc.get_chapter_id({'id': f'https://kireicake.com/?p={chapter_id}'}),
            chapter_id
        )

    def test_get_group_returns_NAME(self):
        self.assertEqual(self.get_scraper().get_group({}), KireiCake.NAME)

    def test_get_manga_title_returns_title(self):
        kc = self.get_scraper()
        manga_title = 'Test manga title'
        data = {
            'tags': [
                {'term': 'Projects'},
                {'term': manga_title}
            ]
        }
        found_title = kc.get_manga_title(data)
        self.assertEqual(found_title, manga_title)

    def test_get_manga_title_works_with_empty_dict(self):
        self.assertIsNone(self.get_scraper().get_manga_title({}))

    def test_parse_entries_returns_correct_entries(self):
        feed = feedparser.parse(test_feed)
        kc = self.get_scraper()
        entries = kc.parse_feed(feed.entries)

        # Make sure all entries are present
        self.assertEqual(len(entries), len(correct_entries.keys()))
        for entry in entries:
            correct = correct_entries.get(entry.chapter_identifier)
            self.assertIsNotNone(correct, 'Chapter id not parsed correctly')

            self.assertEqual(entry.chapter_number, correct.chapter_number,
                             f'{correct.manga_title} chapter numbers not equal')
            self.assertEqual(entry.decimal, correct.decimal,
                             f'{correct.manga_title} chapter decimals not equal')
            self.assertEqual(entry.manga_title, correct.manga_title,
                             f'{correct.manga_title} manga titles not equal')
            self.assertDatesEqual(entry.release_date, correct.release_date)
            self.assertEqual(entry.title_id, correct.title_id,
                             f'{correct.manga_title} title ids not equal')
            self.assertEqual(entry.title, correct.title,
                             f'{correct.manga_title} titles not equal')
            self.assertEqual(entry.group, correct.group,
                             f'{correct.manga_title} groups not equal')
            self.assertEqual(entry.manga_url, correct.manga_url,
                             f'{correct.manga_title} manga urls not equal')

    @patch('feedparser.parse', wraps=mock_feedparse(test_feed))
    def test_scrape_service_works_correctly(self, parse: MagicMock):
        kc = self.get_scraper()
        updated = kc.scrape_service(kc.ID, 'test_feed', None)
        parse.assert_called_once()
        parse.assert_called_with('test_feed')

        unique_manga = len(set(map(KireiCake.Chapter.title_id.fget, correct_entries.values())))  # type: ignore[attr-defined]
        self.assertIsNotNone(updated)
        self.assertEqual(unique_manga, len(updated), 'Not all manga updated')

    @patch('feedparser.parse', wraps=mock_feedparse('invalid_feed'))
    def test_scrape_service_returns_nothing_on_error(self, parse: MagicMock):
        kc = self.get_scraper()
        updated = kc.scrape_service(kc.ID, 'invalid_feed', None)
        parse.assert_called_once()
        parse.assert_called_with('invalid_feed')

        self.assertIsNone(updated)


if __name__ == '__main__':
    unittest.main()
