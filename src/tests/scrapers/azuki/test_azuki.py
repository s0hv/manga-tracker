import os
import re
from datetime import datetime, timezone
from unittest.mock import patch, Mock

import pytest
import responses

import src.scrapers.azuki
from src.constants import NO_GROUP
from src.scrapers.azuki import Azuki, ParsedChapter
from src.tests.testing_utils import ChapterTestModel, BaseTestClasses
from src.utils.utilities import utctoday


class TempChapter(ParsedChapter):
    def __init__(self):
        pass


correct_chapters = [
    ChapterTestModel(
        chapter_title='Chapter 76',
        chapter_number=76,
        volume=None,
        decimal=None,
        release_date=datetime.fromisoformat('2022-06-06T00:00:00.000').replace(tzinfo=timezone.utc),
        chapter_identifier='ba35fe70-bb3d-4540-b1d2-2dd5d256f246',
        title_id='grand-blue-dreaming',
        group='Azuki',
        title='Chapter 76',
        manga_title='Grand Blue Dreaming',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='Dress-Up',
        chapter_number=75,
        volume=None,
        decimal=None,
        release_date=datetime.fromisoformat('2022-02-06T00:00:00.000').replace(tzinfo=timezone.utc),
        chapter_identifier='d918e3ec-2659-4f17-8372-b01ce480a822',
        title_id='grand-blue-dreaming',
        group='Azuki',
        title='Dress-Up',
        manga_title='Grand Blue Dreaming',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='Drunken Ping-Pong',
        chapter_number=74,
        volume=None,
        decimal=5,
        release_date=datetime.fromisoformat('2022-01-06T00:00:00.000').replace(tzinfo=timezone.utc),
        chapter_identifier='82cdddf2-85c5-4d09-b5ff-0bc6633402e0',
        title_id='grand-blue-dreaming',
        group='Azuki',
        title='Drunken Ping-Pong',
        manga_title='Grand Blue Dreaming',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='Chapter 58',
        chapter_number=58,
        volume=None,
        decimal=None,
        release_date=utctoday(),
        chapter_identifier='f6c8065d-3a4f-4f3c-85cf-9202f552dae5',
        title_id='grand-blue-dreaming',
        group='Azuki',
        title='Chapter 58',
        manga_title='Grand Blue Dreaming',
        group_id=NO_GROUP),
]


def get_date(s: str):
    return datetime.strptime(s, '%b %d, %Y').replace(tzinfo=timezone.utc)


correct_chapters_releases = [
    ChapterTestModel(
        chapter_title='Chapter 387',
        chapter_number=387,
        volume=None,
        decimal=None,
        release_date=get_date('Jun 1, 2022'),
        chapter_identifier='8f497aab-c1dd-4409-9518-ea46ab93728c',
        title_id='space-brothers',
        group='Azuki',
        title='Chapter 387',
        manga_title='Space Brothers',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='Chapter 193',
        chapter_number=193,
        volume=None,
        decimal=None,
        release_date=get_date('May 31, 2022'),
        chapter_identifier='de027ef6-d451-47cd-beb8-0b96ad42d76b',
        title_id='edens-zero',
        group='Azuki',
        title='Chapter 193',
        manga_title='EDENS ZERO<',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='Chapter 126-127',
        chapter_number=126,
        volume=None,
        decimal=None,
        release_date=get_date('May 26, 2022'),
        chapter_identifier='f496ee56-33b5-46a2-bbba-ab28b0cad4f3',
        title_id='kakushigoto-my-dads-secret-ambition',
        group='Azuki',
        title='Chapter 126-127',
        manga_title="Kakushigoto: My Dad's Secret Ambition",
        group_id=NO_GROUP)
]


base_path = os.path.dirname(__file__)
manga_page_path = os.path.join(base_path, 'manga_page.html')
releases_page_path = os.path.join(base_path, 'release_page.html')


class AzukiTest(BaseTestClasses.DatabaseTestCase, BaseTestClasses.ModelAssertions):
    def get_scraper(self) -> Azuki:
        return Azuki(self.conn, self.dbutil)

    @responses.activate
    def test_parse_manga_page(self):
        title_id = 'grand-blue-dreaming'
        with open(manga_page_path, 'r', encoding='utf-8') as f:
            data = f.read()
        responses.add(responses.GET, Azuki.MANGA_URL_FORMAT.format(title_id), body=data)

        azuki = self.get_scraper()

        group_id = self.dbutil.get_or_create_group(Azuki.NAME).group_id
        for c in correct_chapters:
            c.group_id = group_id

        self.delete_chapters(Azuki.ID)
        chapter_ids = azuki.scrape_series(title_id, Azuki.ID, None)

        self.assertTrue(chapter_ids)

        chapters = self.dbutil.get_chapters(None, Azuki.ID)

        for parsed, correct in zip(sorted(chapters, key=self.chapterSortKey), sorted(correct_chapters, key=self.chapterSortKey)):
            self.assertChaptersEqual(parsed, correct)

    @responses.activate
    @patch.object(src.scrapers.azuki, 'utctoday', Mock())
    def test_parse_releases_page(self):
        src.scrapers.azuki.utctoday.return_value = get_date('Jun 1, 2022').replace(tzinfo=timezone.utc)

        with open(releases_page_path, 'r', encoding='utf-8') as f:
            data = f.read()
        responses.get(Azuki.FEED_URL, body=data)
        resp = responses.get(re.compile(Azuki.MANGA_URL_FORMAT.format('.+')), status=500)
        resp.aaaa = 2

        azuki = self.get_scraper()

        group_id = self.dbutil.get_or_create_group(Azuki.NAME).group_id
        for c in correct_chapters_releases:
            c.group_id = group_id

        self.delete_chapters(Azuki.ID)
        retval = azuki.scrape_service(Azuki.ID, Azuki.FEED_URL, None)

        self.assertTrue(retval)
        self.assertEqual(len(retval.manga_ids), 3)
        self.assertEqual(len(retval.chapter_ids), 3)

        self.assertEqual(resp.call_count, 3)

        chapters = self.dbutil.get_chapters(None, Azuki.ID)

        for parsed, correct in zip(sorted(chapters, key=self.chapterSortKey), sorted(correct_chapters_releases, key=self.chapterSortKey)):
            self.assertChaptersEqual(parsed, correct)


@pytest.mark.parametrize('title, correct', [
    ('Chapter 54 extra 1', ('Chapter 54 extra 1', 54, 5)),
    ('Chapter 75ex1', ('Chapter 75ex1', 75, 5)),
    ('Chapter 75ex', ('Chapter 75ex', 75, 5)),
    ('Chapter 75ex2', ('Chapter 75ex2', 75, 5)),
    ('Chapter 74ex – Drunken Ping-Pong', ('Drunken Ping-Pong', 74, 5)),
    ('Chapter 156.2 – Clean Water (2)', ('Clean Water (2)', 156, 2)),
    ('Chapter 79 – Shorthanded', ('Shorthanded', 79, None)),
    ('Chapter 79b', ('Chapter 79b', 79, 2)),
    ('Chapter 79d', ('Chapter 79d', 79, 4)),
    ('Chapter 3b – Special Broadcast: His Unhinged Passions', ('Special Broadcast: His Unhinged Passions', 3, 2)),
    ('Chapter 126-127', ('Chapter 126-127', 126, None)),
])
def test_parse_chapter_title(title: str, correct):
    ch = TempChapter()
    assert ch.parse_title(title) == correct, f'ParsedChapter.parse_title("{title}") did not equal {correct}'


if __name__ == '__main__':
    pytest.main()
