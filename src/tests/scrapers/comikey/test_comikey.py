import os
import re
from datetime import datetime
from typing import cast
from unittest.mock import MagicMock, patch

import pytest
import responses
from requests import PreparedRequest

from src.constants import NO_GROUP
from src.db.models.chapter import Chapter
from src.db.models.manga import MangaService
from src.scrapers.base_rss import RSSChapter
from src.scrapers.comikey import Comikey
from src.tests.testing_utils import BaseTestClasses, ChapterTestModel, mock_feedparse
from src.utils.dbutils import DbUtil
from src.utils.utilities import utcfromtimestamp

base_path = os.path.dirname(__file__)


def get_date(s: str) -> datetime:
    return utcfromtimestamp(datetime.strptime(s, '%a, %d %b %Y %H:%M:%S %z').timestamp())


correct_chapters = [
    ChapterTestModel(
        chapter_title=None,
        chapter_number=20,
        volume=None,
        decimal=None,
        release_date=get_date('Thu, 20 Jan 2022 08:00:00 -0800'),
        chapter_identifier='test-title/kN6mRk/episode-20',
        title_id='test-title/1',
        group='Comikey',
        title='Chapter 20',
        manga_title='Test title',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='This a chapter name',
        chapter_number=111,
        volume=None,
        decimal=None,
        release_date=get_date('Thu, 20 Jan 2022 07:00:00 -0800'),
        chapter_identifier='test-title/k2z19k/chapter-111',
        title_id='test-title/1',
        group='Comikey',
        title='This a chapter name',
        manga_title='This a manga',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='name',
        chapter_number=83,
        volume=None,
        decimal=None,
        release_date=get_date('Thu, 20 Jan 2022 07:00:00 -0800'),
        chapter_identifier='special-name/eZYOYD/chapter-83',
        title_id='special-name/2',
        group='Comikey',
        title='name',
        manga_title='Manga with',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title=None,
        chapter_number=84,
        volume=None,
        decimal=4,
        release_date=get_date('Thu, 20 Jan 2022 07:00:00 -0800'),
        chapter_identifier='test-title/kGp5gD/chapter-84-4',
        title_id='test-title/1',
        group='Comikey',
        title='Chapter 84.4',
        manga_title='Manga',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title='abcde',
        chapter_number=29,
        volume=None,
        decimal=1,
        release_date=get_date('Thu, 20 Jan 2022 07:00:00 -0800'),
        chapter_identifier='test-title/oKrVMe/chapter-29-1',
        title_id='test-title/1',
        group='Comikey',
        title='abcde',
        manga_title='Decimal chapter',
        group_id=NO_GROUP),

    ChapterTestModel(
        chapter_title=None,
        chapter_number=83,
        volume=None,
        decimal=None,
        release_date=get_date('Thu, 20 Jan 2022 07:00:00 -0800'),
        chapter_identifier='special-name/k1z13D/chapter-83',
        title_id='special-name/2',
        group='Comikey',
        title='Chapter 83',
        manga_title='Manga with',
        group_id=NO_GROUP),
]


correct_chapters_manga_feed = [
    Chapter(
        manga_id=0,
        chapter_number=20,
        decimal=None,
        release_date=get_date('Thu, 20 Jan 2022 08:00:00 -0800'),
        chapter_identifier='test-title/abc/episode-20',
        title_id='test-title/1',
        title='Chapter 20',
        group_id=NO_GROUP,
        service_id=Comikey.ID
    ),

    Chapter(
        manga_id=0,
        chapter_number=21,
        decimal=None,
        release_date=get_date('Thu, 20 Jan 2022 08:00:00 -0800'),
        chapter_identifier='test-title/abcdef/episode-21',
        title_id='test-title/1',
        title='Name',
        group_id=NO_GROUP,
        service_id=Comikey.ID
    ),
]


class ComikeyTest(BaseTestClasses.DatabaseTestCase, BaseTestClasses.ModelAssertions):
    test_feed = os.path.join(base_path, 'feed.xml')
    test_manga_feed = os.path.join(base_path, 'manga_feed.xml')
    manga_url = re.compile(r'https://comikey.com/comics/(\w|-)+')
    manga_id: int = NotImplemented

    redirects = {
        'special-name': 'special-name/2',
        'test-title': 'test-title/1'
    }

    @pytest.fixture(autouse=True, scope='class')
    def _set_up_comikey(self, class_dbutil: DbUtil, request: pytest.FixtureRequest) -> None:
        dbutil = class_dbutil
        request.cls.manga_id = cast(int, dbutil.add_manga_service(MangaService(
            service_id=Comikey.ID,
            title_id='test-title/1',
            title="Test manga"
        ), add_manga=True).manga_id)

        for c in correct_chapters_manga_feed:
            c.manga_id = request.cls.manga_id

    def setUp(self) -> None:
        super().setUp()
        self.comikey = Comikey(self._conn, self.dbutil)
        self.comikey.get_group_id = lambda *_, **__: NO_GROUP  # type: ignore
        self.comikey.id_cache.clear()

    def redirect(self, request: PreparedRequest) -> tuple[int, dict[str, str], bytes | None]:
        if not request.url:
            return 200, {}, None

        title_id = request.url.split('/')[-1]
        if not title_id or title_id.isnumeric():
            return 200, {}, None

        redirect_headers = {"location": f"/comics/{self.redirects[title_id]}/"}
        return 301, redirect_headers, b""

    @responses.activate
    @patch('feedparser.parse', wraps=mock_feedparse(test_feed))
    def test_feed_parsing(self, parse: MagicMock):
        feed_url = 'http://comikey.com/feed.rss'
        responses.add_callback(responses.HEAD, self.manga_url, self.redirect)

        chapters = self.comikey.get_feed_chapters(feed_url)

        parse.assert_called_once()
        parse.assert_called_with(feed_url)

        # Each redirect is counted as a separate request
        # One manga has already been added to the db
        assert len(responses.calls) == 2, 'All requests not done'
        assert len(Comikey.id_cache) == 2

        assert chapters is not None
        self.assertAllChaptersEqual(cast(list[RSSChapter], chapters), correct_chapters)

    @responses.activate
    @patch('feedparser.parse', wraps=mock_feedparse(test_manga_feed))
    def test_scrape_series(self, parse: MagicMock):
        self.delete_chapters(Comikey.ID)
        feed_url = 'https://comikey.com/sapi/comics/1/feed.rss'
        title_id = 'test-title/1'
        responses.add_callback(responses.HEAD, self.manga_url, self.redirect)

        success = self.comikey.scrape_series(title_id, Comikey.ID, self.manga_id)

        parse.assert_called_once()
        parse.assert_called_with(feed_url)

        # Each redirect is counted as a separate request
        assert len(responses.calls) == 0, 'Requests found when title id should have been cached'
        assert len(Comikey.id_cache) == 1
        assert success, 'Series scraping status not successful'

        new_chapters = self.dbutil.get_chapters(None, Comikey.ID)
        self.assertAllDbChaptersEqual(
            new_chapters,
            correct_chapters_manga_feed
        )

    @patch.object(Comikey, 'get_chapter_id')
    def test_language_skip(self, mock: MagicMock):
        chapter_ids = [
            'test/kjZYvk/bab-bahasa-123',
            'test/o6r5Lo/capitulo-portugues-1/',
            'abc/k5bVOD/capitulo-espanol-100',
            'abc/k5bVOD/capitulo-espanol-100-1'
        ]
        for chapter_id in chapter_ids:
            mock.return_value = chapter_id
            assert self.comikey.skip_entry({}), 'Chapter in another language was not skipped'

        valid_chapters = [
            'test/eZ5PLD/chapter-123',
            'a/k2Ga7D/episode-1',
            'a/k2Ga7D/episode-1-1'
        ]
        for chapter_id in valid_chapters:
            mock.return_value = chapter_id
            assert not self.comikey.skip_entry({}), 'Valid chapter skipped'
