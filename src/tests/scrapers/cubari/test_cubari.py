from datetime import datetime, timezone
from pathlib import Path

import pytest
import responses

from src.constants import NO_GROUP
from src.db.models.chapter import ChapterFailed
from src.scrapers.cubari import Cubari
from src.tests.testing_utils import BaseTestClasses, ChapterTestModel

TITLE_ID = 'gist/OPM'  # Example title ID for testing fetching manga data

base_path = Path(__file__).parent
manga_page_path = base_path / 'cubari.html'

correct_parsed_chapters = sorted([
    ChapterTestModel(
        chapter_title='',
        chapter_number=208,
        volume=None,
        decimal=None,
        release_date='2025-06-19T07:48:26+00:00',
        chapter_identifier='208',
        title_id=TITLE_ID,
        manga_title='One Punch Man',
        group='/r/OnePunchMan',
        title='Chapter 208',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='(Back of My Head | Volume 25 Extras)',
        chapter_number=121,
        volume=None,
        decimal=5,
        release_date='2022-11-29T14:47:22+00:00',
        chapter_identifier='121-5',
        title_id=TITLE_ID,
        manga_title='One Punch Man',
        group='/r/OnePunchMan',
        title='(Back of My Head | Volume 25 Extras)',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='A Glimpse Behind The Scenes',
        chapter_number=119,
        volume=None,
        decimal=None,
        release_date='2021-07-30T20:38:43+00:00',
        chapter_identifier='119',
        title_id=TITLE_ID,
        manga_title='One Punch Man',
        group=None,
        title='A Glimpse Behind The Scenes',
        group_id=NO_GROUP),
], key=lambda c: c.chapter_identifier)

chapters_failed_expected = [
    ChapterFailed(
        service_id=Cubari.ID,
        errors='Failed to find time element in chapter row',
        title='Chapter 50 Title',
        chapter_number=None,
        title_id=TITLE_ID,
        manga_title='One Punch Man',
        release_date=None,
        group='/r/OnePunchMan',
        chapter_identifier='fail-date',
    ),
    ChapterFailed(
        service_id=Cubari.ID,
        errors='Chapter number not found from attribute data-chapter',
        title='Chapter 51 Title',
        chapter_number=None,
        title_id=TITLE_ID,
        manga_title='One Punch Man',
        release_date=datetime.fromisoformat('2023-02-15T10:00:00').replace(tzinfo=timezone.utc),
        group='/r/OnePunchMan',
        chapter_identifier='fail-chapternum',
    ),
    ChapterFailed(
        service_id=Cubari.ID,
        errors='Failed to parse chapter title from Random Bonus',
        title='Random Bonus',
        chapter_number=52,
        title_id=TITLE_ID,
        manga_title='One Punch Man',
        release_date=datetime.fromisoformat('2023-06-20T09:30:00').replace(tzinfo=timezone.utc),
        group='/r/OnePunchMan',
        chapter_identifier='fail-title',
    ),
]


class CubariTests(BaseTestClasses.DatabaseTestCase, BaseTestClasses.ModelAssertions):
    def get_scraper(self) -> Cubari:
        return Cubari(self.conn, self.dbutil)

    def delete_groups(self):
        self.conn.execute("""
            DELETE FROM groups
            USING chapters
            WHERE chapters.group_id=groups.group_id AND chapters.service_id=%s
        """, (Cubari.ID,))

    @responses.activate
    def test_parse_manga_page(self):
        self.delete_groups()
        self.delete_failed_chapters(Cubari.ID)

        with manga_page_path.open(encoding='utf-8') as f:
            data = f.read()
        responses.add(responses.GET, Cubari.MANGA_URL_FORMAT.format(TITLE_ID), body=data)

        cubari = self.get_scraper()

        group_id = self.dbutil.get_or_create_group('/r/OnePunchMan').group_id
        for c in correct_parsed_chapters:
            c.group_id = group_id

        chapter_ids = cubari.scrape_series(TITLE_ID, Cubari.ID, 0)

        assert chapter_ids

        chapters = self.dbutil.get_chapters(None, Cubari.ID)

        for parsed, correct in zip(sorted(chapters, key=self.chapterSortKey), sorted(correct_parsed_chapters, key=self.chapterSortKey), strict=True):
            self.assertChaptersEqual(parsed, correct)

        self.assertFailedChaptersHandled(Cubari.ID, chapters_failed_expected)


if __name__ == '__main__':
    pytest.main()
