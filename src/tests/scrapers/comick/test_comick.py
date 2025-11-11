import json
import logging
from pathlib import Path
from typing import override

import pytest
import responses
from psycopg.rows import class_row
from pydantic import TypeAdapter
from responses import matchers

from src.constants import NO_GROUP
from src.db.models.chapter import Chapter
from src.db.models.groups import Group, GroupPartial
from src.db.models.manga import MangaService
from src.scrapers.comick.comick import Comick
from src.scrapers.comick.comick_api import ChapterResultWithManga
from src.tests.testing_utils import BaseTestClasses, ChapterTestModel

TITLE_ID = 'xui1JrAT'  # Example title ID for testing fetching manga data

correct_parsed_chapters = sorted([
    ChapterTestModel(
        chapter_title=None,
        chapter_number=2,
        volume=None,
        decimal=None,
        release_date='2025-06-20T18:38:12.971Z',
        chapter_identifier='U7pECDbB',
        title_id='XO9lSYgH',
        manga_title='Reincarnation of the Online Game Addict: I Can’t Use the Overpowered Fists That Made Me the Fist King, so Now I Swing a Club for Eight Hours a Day',  # noqa: RUF001
        group='Asmodeus Scans',
        title='Chapter 2',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title=None,
        chapter_number=1,
        volume=1,
        decimal=None,
        release_date='2025-06-20T18:38:07.000Z',
        chapter_identifier='7lvxHRXu',
        title_id='OjGxkU_t',
        manga_title='Dragon ball An earth without Goku',
        group='Dragon ball Fan upload',
        title='Volume 1, Chapter 1',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title=None,
        chapter_number=39,
        volume=None,
        decimal=4,
        release_date='2025-06-20T18:36:50.000Z',
        chapter_identifier='hLssJWwq',
        title_id='8PQyxUnp',
        manga_title='Shou Akuma JK Psycho',
        group=None,
        title='Chapter 39.4',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title=None,
        chapter_number=748,
        volume=5,
        decimal=14,
        release_date='2025-06-20T18:31:32.000Z',
        chapter_identifier='rKMBV7dZ',
        title_id='2yCn9_ZI',
        manga_title="I'm the Great Immortal",
        group='manhuaplus',
        title='Volume 5, Chapter 748.14',
        group_id=NO_GROUP)
], key=lambda c: c.chapter_identifier)


class ComickTests(BaseTestClasses.DatabaseTestCase, BaseTestClasses.ModelAssertions):
    API_URL = 'https://api.comick.fun'

    chapters_data: dict = NotImplemented
    manga_data: dict = NotImplemented

    @pytest.fixture(autouse=True)
    def _caplog(self, caplog: pytest.LogCaptureFixture):
        self.caplog = caplog

    @pytest.fixture(autouse=True)
    def load_data(self):
        api_path = Path(__file__).parent.joinpath('api_data')

        with api_path.joinpath('chapters.json').open(encoding='utf-8') as f:
            self.chapters_data = json.load(f)

        with api_path.joinpath('manga.json').open(encoding='utf-8') as f:
            self.manga_data = json.load(f)

    @override
    def setUp(self) -> None:
        super().setUp()
        self.comick = Comick(self.conn, self.dbutil)

    @override
    def delete_chapters(self, service_id: int = Comick.ID):
        super().delete_chapters(service_id)

    def delete_groups(self):
        self.conn.execute("""
            DELETE FROM groups
            USING chapters
            WHERE chapters.group_id=groups.group_id AND chapters.service_id=%s
        """, (Comick.ID,))

    def set_up_api(self):
        chapter_params = {
            'order': 'new',
            'tachiyomi': 'true',
            'lang': 'en',
        }
        responses.add(
            responses.GET,
            f'{self.API_URL}/chapter/',
            json=self.chapters_data,
            match=[matchers.query_param_matcher(chapter_params)])

        manga_params = {
            'lang': 'en',
            'page': '1',
            'limit': '150',
        }
        responses.add(
            responses.GET,
            f'{self.API_URL}/comic/{TITLE_ID}/chapters',
            json=self.manga_data,
            match=[matchers.query_param_matcher(manga_params)],
        )

    @responses.activate
    def test_invalid_chapters_result(self):
        responses.add(
            responses.GET,
            f'{self.API_URL}/chapter/',
            status=500,
            match=[matchers.query_param_matcher(None, strict_match=False)])

        logger = logging.getLogger('src.scrapers.comick.comick')

        with self.caplog.at_level(logging.ERROR, logger=logger.name):
            retval = self.comick.scrape_service(self.comick.ID, self.comick.FEED_URL, None)
            assert retval is None
            self.assertLogs(logger, logging.ERROR)

    def test_parse_feed(self):
        adapter = TypeAdapter(list[ChapterResultWithManga])
        chapters = adapter.validate_python(self.chapters_data)
        parsed = self.comick.parse_feed(chapters, None)
        for chapter in parsed:
            # Parse feed does not handle fetching groups
            chapter.group_id = NO_GROUP

        assert len(parsed) == len(correct_parsed_chapters), 'Not all chapters parsed'

        for actual, expected in zip(sorted(parsed, key=lambda c: c.chapter_identifier), correct_parsed_chapters, strict=True):
            self.assertChaptersEqual(actual, expected)

    def test_scrape_service_without_feed_url_throws(self):
        with pytest.raises(ValueError, match='feed_url cannot be None'):
            self.comick.scrape_series('', 1, 1, None)

    @responses.activate
    def test_scrape_service(self) -> None:
        self.delete_chapters()
        self.set_up_api()
        service_id = self.comick.ID
        chapter_count = 4
        manga_count = 4
        group_count = 4

        retval = self.comick.scrape_service(service_id, self.comick.FEED_URL, None)
        assert retval is not None

        assert len(retval.manga_ids) == manga_count, 'Updated manga count invalid'
        assert len(retval.chapter_ids) == len(correct_parsed_chapters), 'Updated manga count invalid'
        assert not [r for r in self.caplog.records if r.levelno >= logging.WARNING], 'Warnings found'

        # Assert the correct number of chapters
        chapters: list[Chapter] = list(
            map(Chapter.model_validate, self.dbutil.execute('SELECT * FROM chapters WHERE service_id=%s', (service_id,)))
        )
        assert len(chapters) == chapter_count

        # Assert groups added
        assert len({c.group_id for c in chapters}) == group_count

        self.assertMangaWithTitleFound('Reincarnation of the Online Game Addict: I Can’t Use the Overpowered Fists That Made Me the Fist King, so Now I Swing a Club for Eight Hours a Day')  # noqa: RUF001

        retval = self.comick.scrape_service(service_id, self.comick.FEED_URL, None)
        assert retval is not None
        assert len(retval.chapter_ids) == 0
        assert len(retval.manga_ids) == 0

    @responses.activate
    def test_scrape_series(self):
        self.delete_chapters()
        self.set_up_api()

        service_id = self.comick.ID
        chapter_count = 9
        group_count = 1
        ms = MangaService(
            service_id=service_id,
            title_id=TITLE_ID,
            title='Vinland Saga',
            feed_url=None
        )
        ms = self.dbutil.add_manga_service(ms, add_manga=True)
        manual_chapter = Chapter(
            manga_id=ms.manga_id,
            service_id=service_id,
            chapter_number=219,
            chapter_identifier='CJSi0xIa',
            group_id=NO_GROUP,
            release_date='2025-06-05T16:23:45.000Z',
            title='Chapter 219',
            group='Project Vinland',
        )
        existing_chapter = self.dbutil.add_chapters([manual_chapter])[0]

        assert ms.manga_id is not None
        retval = self.comick.scrape_series(ms.title_id, service_id, ms.manga_id, self.comick.FEED_URL)
        assert retval is not None

        assert len(retval) == chapter_count, 'New chapter count invalid'
        assert not [r for r in self.caplog.records if r.levelno >= logging.WARNING], 'Warnings found'

        # Assert the correct number of chapters
        chapters: list[Chapter] = list(
            map(Chapter.model_validate, self.dbutil.execute('SELECT * FROM chapters WHERE service_id=%s', (service_id,)))
        )
        # +1 for the manually added chapter
        assert len(chapters) == chapter_count + 1

        # Assert groups added excluding the manually added chapter
        assert len({c.group_id for c in chapters if c.chapter_id != existing_chapter.chapter_id}) == group_count

        # Assert chapter title updated
        new_chapter = self.dbutil.get_chapters_by_id([existing_chapter.chapter_id], [ms.manga_id])[0]
        assert new_chapter.title != manual_chapter.title, 'Chapter title not updated'
        assert new_chapter.title == 'Again and again'

        retval = self.comick.scrape_series(ms.title_id, service_id, ms.manga_id, self.comick.FEED_URL)
        assert retval is not None
        assert len(retval) == 0, 'No new chapters should be found'

    @responses.activate
    def test_duplicate_group(self):
        self.delete_chapters()
        self.set_up_api()
        service_id = self.comick.ID

        retval = self.comick.scrape_service(service_id, self.comick.FEED_URL, None)
        assert retval is not None

        assert len(retval.manga_ids) > 0, 'Nothing updated'
        assert len(retval.chapter_ids) > 0, 'Nothing updated'
        assert not [r for r in self.caplog.records if r.levelno >= logging.WARNING], 'Warnings found'

        groups_before = self.conn.execute('SELECT COUNT(*) as count FROM groups').fetchone()
        # Only delete chapters, leaves groups as is
        self.delete_chapters()
        groups_after = self.conn.execute('SELECT COUNT(*) as count FROM groups').fetchone()

        assert groups_before == groups_after

        retval = self.comick.scrape_service(service_id, self.comick.FEED_URL, None)
        assert retval is not None

        assert len(retval.manga_ids) > 0, 'Nothing updated'
        assert len(retval.chapter_ids) > 0, 'Nothing updated'
        assert not [r for r in self.caplog.records if r.levelno >= logging.WARNING], 'Warnings found'

    @responses.activate
    def test_existing_group(self):
        self.delete_chapters()
        self.delete_groups()
        self.set_up_api()
        service_id = self.comick.ID

        groups = [GroupPartial(name=c) for c in {c.group for c in correct_parsed_chapters if c.group is not None}]
        assert len(groups) > 2
        groups = list(groups)[:2]
        exist_groups = list(self.dbutil.add_new_groups(groups))

        retval = self.comick.scrape_service(service_id, self.comick.FEED_URL, None)

        assert retval is not None

        assert len(retval.manga_ids) > 0, 'Nothing updated'
        assert len(retval.chapter_ids) > 0, 'Nothing updated'
        assert not [r for r in self.caplog.records if r.levelno >= logging.WARNING], 'Warnings found'

        with self.conn.cursor(row_factory=class_row(Group)) as cur:
            cur.execute('SELECT g.* FROM groups g INNER JOIN chapters c ON g.group_id = c.group_id WHERE g.group_id != %s AND c.service_id=%s GROUP BY g.group_id', (NO_GROUP, Comick.ID))
            all_groups: list[Group] = cur.fetchall()
            all_groups_dict: dict[str, Group] = {g.name: g for g in all_groups}

            assert len(all_groups) == len(all_groups_dict), 'Not all existing groups processed properly'

        for group in exist_groups:
            assert all_groups_dict[group.name].mangadex_id is None

        assert len(all_groups) > len(exist_groups)


if __name__ == '__main__':
    pytest.main()
