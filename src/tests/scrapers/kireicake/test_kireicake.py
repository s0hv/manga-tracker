import os
import unittest
from datetime import datetime, timedelta

import responses

from src.scrapers.base_scraper import BaseChapterSimple
from src.scrapers.kireicake import KireiCake
from src.tests.utils.test_dbutil import BaseTestClasses
from src.utils.dbutils import DbUtil

test_feed = os.path.join(os.path.dirname(__file__), 'feed.html')


def get_date(s: str):
    return datetime.strptime(s, '%Y.%m.%d')


# Entries that should be in feed.xml
correct_entries = {
    'my_death_flags_show_no_sign_of_ending/en/0/24': BaseChapterSimple(
        chapter_identifier='my_death_flags_show_no_sign_of_ending/en/0/24',
        chapter_number=24,
        decimal=None,
        manga_title='My Death Flags Show No Sign of Ending',
        release_date=datetime.combine(datetime.now(), datetime.min.time()),
        title_id='my_death_flags_show_no_sign_of_ending',
        chapter_title='Chapter 24',
        group=KireiCake.NAME,
    ),
    'sweet_dreams_in_the_demon_castle/en/0/239': BaseChapterSimple(
        chapter_identifier='sweet_dreams_in_the_demon_castle/en/0/239',
        chapter_number=239,
        decimal=None,
        manga_title='Sweet Dreams in the Demon Castle',
        release_date=datetime.combine(datetime.now() - timedelta(hours=24), datetime.min.time()),
        title_id='sweet_dreams_in_the_demon_castle',
        chapter_title='The 239th Night',
        group=KireiCake.NAME,
    ),
    'helck_vlundio_surreal_sword_saga/en/0/0/5': BaseChapterSimple(
        chapter_identifier='helck_vlundio_surreal_sword_saga/en/0/0/5',
        chapter_number=0,
        decimal=5,
        manga_title='Helck: Völundio ~Surreal Sword Saga~',
        release_date=get_date('2020.08.25'),
        title_id='helck_vlundio_surreal_sword_saga',
        chapter_title='Bonus',
        group=KireiCake.NAME,
    ),
    'helck_vlundio_surreal_sword_saga/en/0/0': BaseChapterSimple(
        chapter_identifier='helck_vlundio_surreal_sword_saga/en/0/0',
        chapter_number=0,
        decimal=None,
        manga_title='Helck: Völundio ~Surreal Sword Saga~',
        release_date=get_date('2020.08.24'),
        title_id='helck_vlundio_surreal_sword_saga',
        chapter_title='Prologue',
        group=KireiCake.NAME,
    )
}


class KireiCakeTest(BaseTestClasses.DatabaseTestCase, BaseTestClasses.ModelAssertions):
    test_data: str = NotImplemented
    group_id: int = NotImplemented

    @classmethod
    def setUpClass(cls) -> None:
        super(KireiCakeTest, cls).setUpClass()
        with open(test_feed, 'r', encoding='utf-8') as f:
            cls.test_data = f.read()

        cls.group_id = DbUtil(cls._conn).get_or_create_group(KireiCake.NAME).group_id
        for c in correct_entries.values():
            c.group_id = cls.group_id

    def get_scraper(self) -> KireiCake:
        return KireiCake(self.conn, self.dbutil)

    def test_parse_entries_returns_correct_entries(self):
        kc = self.get_scraper()
        entries = kc.parse_feed(self.test_data, group_id=self.group_id)

        # Make sure all entries are present
        self.assertEqual(len(entries), len(correct_entries.keys()))
        for entry in entries:
            correct = correct_entries.get(entry.chapter_identifier)
            self.assertIsNotNone(correct, f'Chapter id not parsed correctly for {entry.chapter_identifier}')

            self.assertChaptersEqual(entry, correct)

    @responses.activate
    def test_scrape_service_works_correctly(self):
        responses.add(responses.GET, KireiCake.FEED_URL, body=self.test_data)

        kc = self.get_scraper()
        updated = kc.scrape_service(kc.ID, KireiCake.FEED_URL, None)

        unique_manga = len(set(map(BaseChapterSimple.title_id.fget, correct_entries.values())))  # type: ignore[attr-defined]
        self.assertIsNotNone(updated)
        self.assertEqual(unique_manga, len(updated.manga_ids), 'Not all manga updated')
        self.assertEqual(len(correct_entries), len(updated.chapter_ids), 'Not all chapters added')

        self.assertFalse(kc.scrape_service(kc.ID, KireiCake.FEED_URL, None))
        self.assertMangaWithTitleFound('Helck: Völundio ~Surreal Sword Saga~')

    @responses.activate
    def test_scrape_service_returns_nothing_on_error_status(self):
        responses.add(responses.GET, KireiCake.FEED_URL, status=500)
        kc = self.get_scraper()
        updated = kc.scrape_service(kc.ID, KireiCake.FEED_URL, None)

        self.assertIsNone(updated)


if __name__ == '__main__':
    unittest.main()
