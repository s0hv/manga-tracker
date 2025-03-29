import json
import logging
import os
import unittest
from unittest.mock import Mock, patch

import pytest
import responses
from psycopg.rows import class_row
from pydantic import TypeAdapter

import src.scrapers.mangadex.mangadex
from src.constants import NO_GROUP
from src.db.models.authors import AuthorPartial
from src.db.models.chapter import Chapter
from src.db.models.groups import Group, GroupPartial
from src.db.models.manga import MangaService
from src.scrapers.mangadex import Chapter as MangaDexChapter
from src.scrapers.mangadex import ChapterResult, MangaDex
from src.tests.testing_utils import BaseTestClasses, ChapterTestModel
from src.utils.dbutils import DbUtil
from src.utils.utilities import utcnow

correct_parsed_chapters = sorted([
    ChapterTestModel(
        chapter_title='The Boss Geng Chen has landed',
        chapter_number=24,
        volume=None,
        decimal=5,
        release_date='2021-03-27T00:46:38+00:00',
        chapter_identifier='8b74224c-74a9-4062-ae1b-7ef1c7f1994d',
        title_id='6fe9349a-8eeb-42cf-bead-e6f40b2653de',
        group='The NoNames',
        title='The Boss Geng Chen has landed',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='Words from the Heart (2)',
        chapter_number=46,
        volume=None,
        decimal=None,
        release_date='2021-03-26T03:45:18+00:00',
        chapter_identifier='c30b67e9-c337-471b-9f72-65a9ae56dbc7',
        title_id='6fe9349a-8eeb-42cf-bead-e6f40b2653de',
        group='PMScans',
        title='Words from the Heart (2)',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='Words from the Heart (1)',
        chapter_number=0,
        volume=None,
        decimal=None,
        release_date='2021-03-26T03:44:11+00:00',
        chapter_identifier='035339a1-4b32-4e60-8c02-39735c8ca5b4',
        title_id='b145fa37-e63a-4c1c-a1b8-dc2d3e2ef351',
        group='PMScans',
        title='Words from the Heart (1)',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title=None,
        chapter_number=65,
        volume=1,
        decimal=5,
        release_date='2021-03-25T14:03:06+00:00',
        chapter_identifier='1c307e2b-6c5b-4fe6-aa40-74ba31b89306',
        title_id='fdc7ceb1-dbcf-4624-b50f-772b0e36380c',
        group='Twilight Scans',
        title='Volume 1, Chapter 65.5',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title=None,
        chapter_number=193,
        volume=None,
        decimal=None,
        release_date='2021-03-25T02:58:34+00:00',
        chapter_identifier='cdfe2d56-e9ca-489e-9900-5cfbb9f9d080',
        title_id='4280a53c-817d-4d5c-8276-55dfbd9e4a51',
        group=None,
        title='Chapter 193',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='Chapter 5b',
        chapter_number=5,
        volume=None,
        decimal=2,
        release_date='2021-03-25T02:58:34+00:00',
        chapter_identifier='05d90d16-6530-46c9-8593-80664caf4871',
        title_id='4280a53c-817d-4d5c-8276-55dfbd9e4a51',
        group=None,
        title='Chapter 5b',
        group_id=NO_GROUP)
], key=lambda c: c.chapter_identifier)


class MangadexTests(BaseTestClasses.DatabaseTestCase, BaseTestClasses.ModelAssertions):
    API_URL = 'https://api.mangadex.org'

    chapters_data: dict = NotImplemented
    manga_data: dict = NotImplemented

    @pytest.fixture(autouse=True)
    def _caplog(self, caplog: pytest.LogCaptureFixture):
        self.caplog = caplog

    @pytest.fixture(autouse=True, scope='class')
    def _setup_mangadex(self, class_dbutil: DbUtil) -> None:
        dbutil = class_dbutil
        dbutil.add_authors([
            AuthorPartial(name='Im Dal-Young', mangadex_id='d21a9418-817a-43e5-a4d2-bf1e7391d7ec')
        ])
        dbutil.add_manga_service(MangaService(
            service_id=MangaDex.ID,
            title_id='6fe9349a-8eeb-42cf-bead-e6f40b2653de',
            title="I Was Born as the Demon Lord's Daughter"
        ), add_manga=True)

    @pytest.fixture(autouse=True)
    def load_data(self):
        api_path = os.path.join(os.path.dirname(__file__), 'api_data')

        with open(os.path.join(api_path, 'chapters.json'), encoding='utf-8') as f:
            self.chapters_data = json.load(f)

        with open(os.path.join(api_path, 'manga.json'), encoding='utf-8') as f:
            self.manga_data = json.load(f)

    def setUp(self) -> None:
        super().setUp()
        self.mangadex = MangaDex(self.conn, self.dbutil)

    def delete_chapters(self, service_id: int = MangaDex.ID):
        super().delete_chapters(service_id)

    def delete_groups(self):
        self.conn.execute('''
            DELETE FROM groups
            USING chapters
            WHERE chapters.group_id=groups.group_id AND chapters.service_id=%s
        ''', (MangaDex.ID,))

    def set_up_api(self):
        responses.add(responses.GET, f'{self.API_URL}/chapter',
                      json=self.chapters_data)

        responses.add(responses.GET, f'{self.API_URL}/manga',
                      json=self.manga_data)

    @responses.activate
    @patch.object(src.scrapers.mangadex.mangadex, 'logger', Mock())
    def test_invalid_chapters_result(self):
        responses.add(responses.GET, f'{self.API_URL}/chapter',
                      status=500)

        logger = logging.getLogger('mangadex_test')
        logger.setLevel(logging.ERROR)
        src.scrapers.mangadex.mangadex.logger = logger

        retVal = self.mangadex.scrape_service(self.mangadex.ID, self.mangadex.FEED_URL, None)
        assert retVal is None
        self.assertLogs(logger, logging.ERROR)

    def test_parse_feed(self):
        adapter = TypeAdapter(list[ChapterResult])
        chapters = adapter.validate_python(self.chapters_data['data'])
        parsed = self.mangadex.parse_feed(chapters)
        for chapter in parsed:
            # Parse feed does not handle fetching groups
            chapter.group_id = NO_GROUP

        assert len(parsed) == len(correct_parsed_chapters), 'Not all chapters parsed'

        for actual, expected in zip(sorted(parsed, key=lambda c: c.chapter_identifier), correct_parsed_chapters, strict=True):
            self.assertChaptersEqual(actual, expected)

    def test_scrape_service_without_feed_url_throws(self):
        with pytest.raises(ValueError, match='feed_url cannot be None'):
            self.mangadex.scrape_series('', 1, 1, None)

    @responses.activate
    def test_scrape_service(self) -> None:
        self.delete_chapters()
        self.set_up_api()
        service_id = self.mangadex.ID
        chapter_count = 6
        manga_count = 4
        group_count = 4
        author_count = 4
        artist_count = 4

        retVal = self.mangadex.scrape_service(service_id, self.mangadex.FEED_URL, None)
        assert retVal is not None

        assert len(retVal.manga_ids) == manga_count, 'Updated manga count invalid'
        assert len(retVal.chapter_ids) == len(correct_parsed_chapters), 'Updated manga count invalid'
        assert not [r for r in self.caplog.records if r.levelno >= logging.WARNING], 'Warnings found'

        # Assert correct amount of chapters
        chapters: list[Chapter] = list(
            map(Chapter.model_validate, self.dbutil.execute('SELECT * FROM chapters WHERE service_id=%s', (service_id,)))
        )
        assert len(chapters) == chapter_count

        # Assert groups added
        assert len({c.group_id for c in chapters}) == group_count

        # Assert all covers were set
        format_args = self.dbutil.get_format_args(retVal.manga_ids)
        covers = self.dbutil.execute(f'SELECT cover FROM manga_info WHERE manga_id IN ({format_args})', retVal.manga_ids)
        assert None not in [row['cover'] for row in covers]

        # Assert correct amount of artists added
        assert self.dbutil.execute(f'SELECT COUNT(*) as count FROM manga_artists WHERE manga_id IN ({format_args})', retVal.manga_ids)[0]['count'] == artist_count, 'Not all manga artists added'

        # Assert correct amount of authors added
        assert self.dbutil.execute(f'SELECT COUNT(*) as count FROM manga_authors WHERE manga_id IN ({format_args})', retVal.manga_ids)[0]['count'] == author_count, 'Not all manga authors added'

        self.assertMangaWithTitleFound("Circle Zero's Otherworldly Hero Business: Reboot")

        retval = self.mangadex.scrape_service(service_id, self.mangadex.FEED_URL, None)
        assert retval is not None
        assert len(retval.chapter_ids) == 0
        assert len(retval.manga_ids) == 0

    @responses.activate
    def test_duplicate_group(self):
        self.delete_chapters()
        self.set_up_api()
        service_id = self.mangadex.ID

        retval = self.mangadex.scrape_service(service_id, self.mangadex.FEED_URL, None)
        assert retval is not None

        assert len(retval.manga_ids) > 0, 'Nothing updated'
        assert len(retval.chapter_ids) > 0, 'Nothing updated'
        assert not [r for r in self.caplog.records if r.levelno >= logging.WARNING], 'Warnings found'

        groups_before = self.conn.execute('SELECT COUNT(*) as count FROM groups').fetchone()
        # Only delete chapters, leaves groups as is
        self.delete_chapters()
        groups_after = self.conn.execute('SELECT COUNT(*) as count FROM groups').fetchone()

        assert groups_before == groups_after

        retval = self.mangadex.scrape_service(service_id, self.mangadex.FEED_URL, None)
        assert retval is not None

        assert len(retval.manga_ids) > 0, 'Nothing updated'
        assert len(retval.chapter_ids) > 0, 'Nothing updated'
        assert not [r for r in self.caplog.records if r.levelno >= logging.WARNING], 'Warnings found'

    @responses.activate
    def test_existing_group(self):
        self.delete_chapters()
        self.delete_groups()
        self.set_up_api()
        service_id = self.mangadex.ID

        groups = [GroupPartial(name=c) for c in {c.group for c in correct_parsed_chapters if c.group is not None}]
        assert len(groups) > 2
        groups = list(groups)[:2]
        exist_groups = list(self.dbutil.add_new_groups(groups))

        retval = self.mangadex.scrape_service(service_id, self.mangadex.FEED_URL, None)

        assert retval is not None

        assert len(retval.manga_ids) > 0, 'Nothing updated'
        assert len(retval.chapter_ids) > 0, 'Nothing updated'
        assert not [r for r in self.caplog.records if r.levelno >= logging.WARNING], 'Warnings found'

        with self.conn.cursor(row_factory=class_row(Group)) as cur:
            cur.execute('SELECT g.* FROM groups g INNER JOIN chapters c ON g.group_id = c.group_id WHERE g.group_id != %s AND c.service_id=%s GROUP BY g.group_id', (NO_GROUP, MangaDex.ID))
            all_groups: list[Group] = cur.fetchall()
            all_groups_dict: dict[str, Group] = {g.name: g for g in all_groups}

            assert len(all_groups) == len(all_groups_dict), 'Not all existing groups processed properly'

        for group in exist_groups:
            assert all_groups_dict[group.name].mangadex_id is not None

        assert len(all_groups) > len(exist_groups)


@patch.object(src.scrapers.mangadex.mangadex, 'logger', Mock())
def test_special_chapter_parsing_valid_string(caplog: pytest.LogCaptureFixture):
    logger = logging.getLogger('mangadex_test_chapter_valid')
    logger.setLevel(logging.WARNING)
    src.scrapers.mangadex.mangadex.logger = logger

    chapter = MangaDexChapter('Special', '', '', utcnow(), '', '')
    assert chapter.chapter_number == 0
    assert chapter.decimal is None
    assert not [r for r in caplog.records if r.levelno >= logging.WARNING]


@patch.object(src.scrapers.mangadex.mangadex, 'logger', Mock())
def test_special_chapter_parsing_invalid_string(caplog: pytest.LogCaptureFixture):
    logger = logging.getLogger('mangadex_test_chapter_invalid')
    logger.setLevel(logging.WARNING)
    src.scrapers.mangadex.mangadex.logger = logger

    chapter = MangaDexChapter('idk how to parse', '', '', utcnow(), '', '')
    assert chapter.chapter_number == 0
    assert chapter.decimal is None
    assert [r for r in caplog.records if r.levelno == logging.WARNING]


if __name__ == '__main__':
    unittest.main()
