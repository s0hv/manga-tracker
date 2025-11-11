import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import override
from unittest.mock import patch

import pytest
import responses

from src.constants import NO_GROUP
from src.db.models.chapter import Chapter
from src.scrapers import KManga
from src.scrapers.kmanga import KMangaChapter, KMangaEpisode
from src.scrapers.kmanga.api import hash_params
from src.tests.testing_utils import BaseTestClasses, ChapterTestModel, spy_on

correct_parsed_chapters = sorted(
    [
        ChapterTestModel(
            chapter_title='Nakika and Nagisa',
            chapter_number=1,
            volume=None,
            decimal=None,
            release_date='2025-04-01T10:00:00+00:00',
            chapter_identifier='358374',
            title_id='10639',
            group='Kodansha',
            title='Nakika and Nagisa',
            group_id=NO_GROUP,
        ),
        ChapterTestModel(
            chapter_title='WHERE WILL WE GO? (2)',
            chapter_number=7,
            volume=1,
            decimal=2,
            release_date='2025-04-01T10:00:00+00:00',
            chapter_identifier='358375',
            title_id='10639',
            group='Kodansha',
            title='WHERE WILL WE GO? (2)',
            group_id=NO_GROUP,
        ),
        ChapterTestModel(
            chapter_title='Extra The Passion of Hajime Nojima',
            chapter_number=7,
            volume=None,
            decimal=5,
            release_date='2025-04-01T10:00:00+00:00',
            chapter_identifier='358376',
            title_id='10639',
            group='Kodansha',
            title='Extra The Passion of Hajime Nojima',
            group_id=NO_GROUP,
        ),
        ChapterTestModel(
            chapter_title='All Out!! (2)',
            chapter_number=8,
            volume=None,
            decimal=2,
            release_date='2025-04-01T10:00:00+00:00',
            chapter_identifier='358377',
            title_id='10639',
            group='Kodansha',
            title='All Out!! (2)',
            group_id=NO_GROUP,
        ),
    ],
    key=lambda c: c.chapter_identifier,
)


@dataclass
class Responses:
    chapters: responses.BaseResponse
    title_html: responses.BaseResponse
    latest_updates: responses.BaseResponse


class KMangaTests(BaseTestClasses.DatabaseTestCase, BaseTestClasses.ModelAssertions):
    API_URL = 'https://api.kmanga.kodansha.com'

    chapters_data: dict = NotImplemented
    chapter_html_data: str = NotImplemented
    latest_updates_data: dict = NotImplemented

    @pytest.fixture(autouse=True)
    def _caplog(self, caplog: pytest.LogCaptureFixture):
        self.caplog = caplog

    @pytest.fixture(autouse=True)
    def load_data(self):
        file = Path(__file__).parent

        with file.joinpath('chapters.json').open(encoding='utf-8') as f:
            self.chapters_data = json.load(f)

        with file.joinpath('title.html').open(encoding='utf-8') as f:
            self.chapter_html_data = f.read()

        with file.joinpath('latest_updates.json').open(encoding='utf-8') as f:
            self.latest_updates_data = json.load(f)

    @override
    def setUp(self) -> None:
        super().setUp()
        self.kmanga = KManga(self.conn, self.dbutil)

    @override
    def delete_chapters(self, service_id: int = KManga.ID):
        super().delete_chapters(service_id)

    def reset_titles(self):
        self.conn.execute(
            """
            UPDATE manga_service
            SET last_check=NULL
            WHERE service_id=%s
        """,
            (KManga.ID,),
        )

    def set_up_api(self) -> Responses:

        return Responses(
            chapters=responses.add(
                responses.POST, f'{self.API_URL}/episode/list', json=self.chapters_data
            ),
            title_html=responses.add(
                responses.GET, f'{KManga.URL}/title/10639', body=self.chapter_html_data
            ),
            latest_updates=responses.add(
                responses.GET,
                f'{self.API_URL}/web/top/updated/title',
                json=self.latest_updates_data,
            ),
        )

    @responses.activate
    def test_scrape_service(self) -> None:
        self.delete_chapters()
        self.reset_titles()
        response_mocks = self.set_up_api()
        service_id = self.kmanga.ID
        chapter_count = len(correct_parsed_chapters)
        manga_count = 1

        retVal = self.kmanga.scrape_service(service_id, KManga.FEED_URL, None)
        assert retVal is not None

        assert len(retVal.manga_ids) == manga_count, 'Updated manga count invalid'
        assert len(retVal.chapter_ids) == len(correct_parsed_chapters), (
            'Updated manga count invalid'
        )
        assert not [r for r in self.caplog.records if r.levelno >= logging.WARNING], (
            'Warnings found'
        )

        # Set the correct group ID
        group_id = self.dbutil.get_or_create_group('Kodansha').group_id
        for c in correct_parsed_chapters:
            c.group_id = group_id

        # Assert correct amount of chapters
        chapters: list[Chapter] = list(
            map(
                Chapter.model_validate,
                self.dbutil.execute('SELECT * FROM chapters WHERE service_id=%s', (service_id,)),
            )
        )
        assert len(chapters) == chapter_count

        for actual, expected in zip(
            sorted(chapters, key=lambda c: c.chapter_identifier),
            correct_parsed_chapters,
            strict=True,
        ):
            self.assertChaptersEqual(actual, expected)

        self.assertMangaWithTitleFound('NakiNagi')

        # Assert API call counts
        title_html_response = response_mocks.title_html
        latest_updates_response = response_mocks.latest_updates
        chapters_response = response_mocks.chapters

        assert title_html_response.call_count == 1
        assert latest_updates_response.call_count == 1
        assert chapters_response.call_count == 1

        # Assert the necessary headers and parameters
        latest_updates_headers = latest_updates_response.calls[0].request.headers

        kmanga_hash = latest_updates_headers.get('x-kmanga-hash')

        assert kmanga_hash is not None, 'x-kmanga-hash header not set'
        assert len(kmanga_hash) > 10, 'x-kmanga-hash header should be over 10 characters long'
        assert latest_updates_headers.get('x-kmanga-is-crawler') == 'false', (
            'x-kmanga-is-crawler header should be set to false'
        )
        assert latest_updates_headers.get('x-kmanga-platform') == '3', (
            'x-kmanga-platform header should be set to 3'
        )

        retval = self.kmanga.scrape_service(service_id, KManga.FEED_URL, None)
        assert retval is not None
        assert len(retval.chapter_ids) == 0
        assert len(retval.manga_ids) == 0

        # Assert only the latest_updates API call was made
        assert title_html_response.call_count == 1
        assert latest_updates_response.call_count == 2
        assert chapters_response.call_count == 1

        self.assertNoLogs('debug', logging.WARNING)

    @responses.activate
    def test_invalid_latest_updates_response(self):
        api_url = f'{self.API_URL}/web/top/updated/title'
        responses.add(responses.GET, api_url, status=500)

        logger = logging.getLogger('src.scrapers.kmanga.api')

        with (self.caplog.at_level(logging.ERROR, logger=logger.name),
              pytest.raises(ValueError, match=f'Failed to fetch {api_url}')):
            self.kmanga.scrape_service(self.kmanga.ID, self.kmanga.FEED_URL, None)

        self.assertLogs(logger, logging.ERROR)

    @responses.activate
    def test_skip_when_single_title_errors(self):
        self.delete_chapters()
        self.reset_titles()
        response_mocks = self.set_up_api()

        responses.remove(response_mocks.chapters)
        api_url = f'{self.API_URL}/episode/list'

        chapters_response_error = {
            'status': 'error',
            'error_message': 'Test error message',
            'episode_list': [],
        }

        responses.add(responses.POST, api_url, status=200, json=chapters_response_error)

        logger = logging.getLogger('src.scrapers.kmanga.api')

        with self.caplog.at_level(logging.ERROR, logger=logger.name):
            retval = self.kmanga.scrape_service(self.kmanga.ID, self.kmanga.FEED_URL, None)

        assert retval is not None
        assert len(retval.manga_ids) == 0
        assert len(retval.chapter_ids) == 0

        self.assertLogs('src.scrapers.kmanga', logging.WARNING)
        self.assertLogs(logger, logging.ERROR)

    def test_caches_group(self):
        dbutil = spy_on(self.dbutil)
        kmanga = KManga(self.conn, dbutil)

        kmanga.get_group()
        kmanga.get_group()

        dbutil.get_or_create_group.assert_called_once()  # type: ignore[union-attr]


@patch(
    'src.scrapers.kmanga.api.birthday_cookie',
    {'value': '1992-06', 'expires': 1793814475},
)
@pytest.mark.parametrize(
    ('params', 'expected_hash'),
    [
        (
            {'test': 1},
            '9c3d7415e1db9e285fb8c72e353ad115cb53bdfbf34e58a332ea63b6fc76955beb9205e1c4fae6b21fe0c93ce42c7a51f678b5e35d18e10f2d47e7918803d1af',
        ),
        (
            {'test': [1, 2], 'abc': '2025-01-01'},
            '5edc060202d55092d20f8312373a3527a7b87ea69e478a8ad5e27395eb0f209fa657b7fedcfce727d20b78c3efe4298fc8519f71f3cdbe303c09b18887f595f8',
        ),
        (
            None,
            'a0814e13124e593b27aa03e80a878f81382e73f7eb3c90e437f4d88c7b69e092b668d2a41ace51251a4a8c85c4b1fe8eba20b78636ce73651ab62648f2871ddd',
        ),
    ],
)
def test_hash_params(params: dict | None, expected_hash: str):
    param_hash = hash_params(params)
    assert param_hash == expected_hash, f'hash_params({params}) returned an invalid hash'


@pytest.mark.parametrize(
    ('title', 'correct'),
    [
        ('CHAPTER 12(2) RISK', ('RISK (2)', 12, 2)),
        ('#118(2) One for All', ('One for All (2)', 118, 2)),
        ('#87 Game 2', ('Game 2', 87, None)),
        ('#13(2) Hate', ('Hate (2)', 13, 2)),
        ('Lesson49', ('Lesson49', 49, None)),
        ('Chapter 14(1) THE ABILITY TO HAVE FUN', ('THE ABILITY TO HAVE FUN (1)', 14, 1)),
        ('Chapter 35 MY TWO GIRLFRIENDS (4)', ('MY TWO GIRLFRIENDS (4)', 35, None)),
        ('CHAPTER 1 INSIDE OF ME', ('INSIDE OF ME', 1, None)),
        ('SIDE STORY The Art of Escape', ('SIDE STORY The Art of Escape', 0, 5)),
        ('CHAPTER187 WASTE-FREE', ('WASTE-FREE', 187, None)),
        (
            'CHAPTER 28/CHAPTER 28.5 I Want to Show ThThem/Massage',
            ('/CHAPTER 28.5 I Want to Show ThThem/Massage', 28, None),
        ),
        ('#Final Chapter(1) All Out!!', ('All Out!! (1)', 1, 1)),
        ('FINAL CHAPTER(2)', ('FINAL CHAPTER(2)', 1, 2)),
        ("FINAL CHAPTER We're New at This", ("We're New at This", 1, None)),
        ('TRACK 2 THREATENED MISCARRIAGE(4)', ('TRACK 2 THREATENED MISCARRIAGE(4)', 2, None)),
        ("RULE 8(1) I'LL SHOW YOU DISCIPLINE", ("RULE 8(1) I'LL SHOW YOU DISCIPLINE", 8, 1)),
        ('CHAPTER 208 THOUSAND-YEAR VOYAGE(17)', ('THOUSAND-YEAR VOYAGE(17)', 208, None)),
    ],
)
def test_parse_chapter_title(title: str, correct: tuple[str, int, int | None] | None):
    episode = KMangaEpisode(
        episode_name=title,
        index=1,
        episode_id=1,
        start_time='2025-04-01 10:00:00',
        title_id=1,
    )
    parsed = KMangaChapter.of_kmanga_episode(episode, 1, prev_chapter_number=0, prev_chapter_decimal=0)

    assert (parsed.title, parsed.chapter_number, parsed.decimal) == correct, f'ParsedChapter.parse_title("{title}") did not equal {correct}'


def test_parse_chapter_with_prev_values():
    titles = [
        'TRACK 2 THREATENED MISCARRIAGE(1)',
        'TRACK 2 THREATENED MISCARRIAGE(2)',
        'TRACK 2 THREATENED MISCARRIAGE(3)',
        'TRACK 2 THREATENED MISCARRIAGE(4)',
    ]
    episodes = [
        KMangaEpisode(
            episode_name=title,
            index=idx,
            episode_id=idx,
            start_time='2025-04-01 10:00:00',
            title_id=1,
        )
        for idx, title in enumerate(titles)
    ]

    prev_chapter_number = 0
    prev_chapter_decimal = 0

    parsed_chapters = []

    for episode in episodes:
        parsed = KMangaChapter.of_kmanga_episode(
            episode,
            1,
            prev_chapter_number=prev_chapter_number,
            prev_chapter_decimal=prev_chapter_decimal
        )

        # We know the chapter should be parsed as 2
        prev_chapter_number = 2
        prev_chapter_decimal = parsed.decimal or 0

        parsed_chapters.append(parsed)

    for parsed in parsed_chapters:
        assert parsed.chapter_number == 2

    assert parsed_chapters[0].decimal is None
    assert parsed_chapters[1].decimal == 2
    assert parsed_chapters[2].decimal == 3
    assert parsed_chapters[3].decimal == 4


if __name__ == '__main__':
    pytest.main()
