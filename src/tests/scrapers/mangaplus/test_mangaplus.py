import os
import unittest
from datetime import timedelta
from typing import Optional, cast

import pytest
import requests
import responses

from src.db.models.chapter import Chapter
from src.db.models.manga import MangaServiceWithId
from src.scrapers.mangaplus.mangaplus import (MangaPlus, ResponseWrapper,
                                              TitleDetailViewWrapper)
from src.scrapers.mangaplus.protobuf import mangaplus_pb2
from src.tests.testing_utils import BaseTestClasses, spy_on
from src.utils.utilities import utcfromtimestamp, utcnow


def find_dict_inequality(d1, d2):
    if d1 == d2:
        return True

    for k in d1:
        if d1[k] != d2[k]:
            print(d1[k])
            print(d2[k])
            print(f"{k} doesn't match")
            return False

    return True


class TestMangaPlusParser(BaseTestClasses.DatabaseTestCase):
    request_data_existing: bytes
    request_data_complete: bytes
    request_data_ongoing: bytes
    request_data_oneshot: bytes
    request_data_notfound: bytes
    request_data_award: bytes
    request_data_creators: bytes
    request_data_hiatus: bytes
    request_data_all: bytes
    request_data_otherschedule: bytes

    @staticmethod
    def read_title_detail_data(status: str) -> bytes:
        file = os.path.dirname(__file__)

        with open(os.path.join(file, f'title_detailV3-{status}.dat'), 'rb') as f:
            return f.read()

    @staticmethod
    def read_all_titles_data() -> bytes:
        file = os.path.dirname(__file__)

        with open(os.path.join(file, 'allV2.dat'), 'rb') as f:
            return f.read()

    @classmethod
    def setUpClass(cls) -> None:
        super(TestMangaPlusParser, cls).setUpClass()
        cls.request_data_complete = cls.read_title_detail_data('complete')
        cls.request_data_existing = cls.read_title_detail_data('existing')
        cls.request_data_ongoing = cls.read_title_detail_data('ongoing')
        cls.request_data_oneshot = cls.read_title_detail_data('oneshot')
        cls.request_data_notfound = cls.read_title_detail_data('notfound')
        cls.request_data_award = cls.read_title_detail_data('award')
        cls.request_data_creators = cls.read_title_detail_data('creators')
        cls.request_data_hiatus = cls.read_title_detail_data('hiatus')
        cls.request_data_otherschedule = cls.read_title_detail_data('otherschedule')
        cls.request_data_all = cls.read_all_titles_data()

    def setUp(self) -> None:
        super().setUp()
        self.dbutil = spy_on(self.dbutil)
        self.mangaplus = MangaPlus(self._conn, self.dbutil)
        self.group_id = self.dbutil.get_or_create_group(MangaPlus.GROUP).group_id

    def setup_with_data(self, data: bytes) -> tuple[MangaServiceWithId, set[int] | None]:
        ms = self.create_manga_service(MangaPlus)
        title_id = ms.title_id
        manga_id = ms.manga_id

        responses.add(responses.GET, MangaPlus.API.format(title_id),
                      body=data)
        chapter_ids = self.mangaplus.scrape_series(title_id, MangaPlus.ID, manga_id)

        return ms, chapter_ids

    def reset_service(self, service_id: int):
        self.dbutil.execute(
            'UPDATE service_whole SET next_update=NULL WHERE service_id=%s',
            (service_id,)
        )

        self.dbutil.execute(
            'UPDATE services SET last_check=NULL, disabled_until=NULL WHERE service_id=%s',
            (service_id,)
        )

    @responses.activate
    def test_scrapes_correctly_for_ongoing_manga(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_ongoing)

        self.assertIsNotNone(chapter_ids)
        chapter_ids = cast(set[int], chapter_ids)
        self.assertEqual(len(chapter_ids), 14)
        self.assertEqual(len(responses.calls), 1)

        inserted = self.dbutil.get_chapters(ms.manga_id, ms.service_id, limit=len(chapter_ids))

        last_chapter: Optional[Chapter] = None
        for c in inserted:
            if c.chapter_number == 124:
                last_chapter = c
                break

        self.assertIsNotNone(last_chapter)
        last_chapter = cast(Chapter, last_chapter)

        correct_chapter = Chapter(
            manga_id=ms.manga_id,
            service_id=ms.service_id,
            title="Ombusman",
            chapter_number=124,
            chapter_decimal=None,
            release_date=utcfromtimestamp(1696863600),
            chapter_identifier='1019019',
            group_id=self.group_id
        )
        self.assertDbChaptersEqual(last_chapter, correct_chapter)
        self.assertMangaServiceEnabled(ms.service_id, ms.title_id)
        ms = self.dbutil.get_manga_service(ms.service_id, ms.title_id)
        self.assertDatesEqual(ms.next_update, utcfromtimestamp(1697468400))

    @responses.activate
    def test_scrapes_correctly_for_existing_chapters(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_existing)

        self.assertIsNotNone(chapter_ids)
        chapter_ids = cast(set[int], chapter_ids)
        self.assertEqual(len(chapter_ids), 2)
        self.assertEqual(len(responses.calls), 1)
        self.assertMangaServiceDisabled(ms.service_id, ms.title_id)  # It is completed

    @responses.activate
    def test_scrapes_correctly_for_complete_chapters(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_complete)

        self.assertIsNotNone(chapter_ids)
        chapter_ids = cast(set[int], chapter_ids)
        self.assertEqual(len(chapter_ids), 5)
        self.assertEqual(len(responses.calls), 1)

        inserted = self.dbutil.get_chapters(ms.manga_id, ms.service_id, limit=len(chapter_ids))

        inserted.sort(key=lambda c: c.chapter_number)

        correct_chapters = [
            Chapter(
                manga_id=ms.manga_id,
                service_id=ms.service_id,
                title="Cruelty",
                chapter_number=1,
                chapter_decimal=None,
                release_date=utcfromtimestamp(1547996400),
                chapter_identifier='1000303',
                group_id=self.group_id
            ),
            Chapter(
                manga_id=ms.manga_id,
                service_id=ms.service_id,
                title="The Stranger",
                chapter_number=2,
                chapter_decimal=None,
                release_date=utcfromtimestamp(1547996400),
                chapter_identifier='1000304',
                group_id=self.group_id
            ),
            Chapter(
                manga_id=ms.manga_id,
                service_id=ms.service_id,
                title="To Return By Dawn Without Fail",
                chapter_number=3,
                chapter_decimal=None,
                release_date=utcfromtimestamp(1547996400),
                chapter_identifier='1000305',
                group_id=self.group_id
            )
        ]

        for ch, correct in zip(inserted, correct_chapters):
            self.assertDbChaptersEqual(ch, correct)

        self.assertMangaServiceDisabled(ms.service_id, ms.title_id)

    @responses.activate
    def test_scrapes_correctly_for_other_schedule_chapters(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_otherschedule)

        self.assertIsNotNone(chapter_ids)
        chapter_ids = cast(set[int], chapter_ids)
        self.assertEqual(len(chapter_ids), 1)
        self.assertEqual(len(responses.calls), 1)

        inserted = self.dbutil.get_chapters(ms.manga_id, ms.service_id, limit=len(chapter_ids))

        correct = Chapter(
            manga_id=ms.manga_id,
            service_id=ms.service_id,
            title="Bronze Award: METRA-K",
            chapter_number=0,
            chapter_decimal=None,
            release_date=utcfromtimestamp(1699887600),
            chapter_identifier='1019511',
            group_id=self.group_id
        )

        self.assertDbChaptersEqual(inserted[0], correct)
        self.assertMangaServiceDisabled(ms.service_id, ms.title_id)

    @responses.activate
    def test_scrapes_correctly_for_oneshot(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_oneshot)

        self.assertIsNotNone(chapter_ids)
        chapter_ids = cast(set[int], chapter_ids)
        self.assertEqual(len(chapter_ids), 1)
        self.assertEqual(len(responses.calls), 1)

        inserted = self.dbutil.get_chapters(ms.manga_id, ms.service_id, limit=len(chapter_ids))
        self.assertEqual(len(inserted), 1)

        correct_chapter = Chapter(
            manga_id=ms.manga_id,
            service_id=ms.service_id,
            title="Inside",
            chapter_number=1,
            chapter_decimal=None,
            release_date=utcfromtimestamp(1618326000),
            chapter_identifier='1009202',
            group_id=self.group_id
        )

        self.assertDbChaptersEqual(inserted[0], correct_chapter)
        self.assertMangaServiceDisabled(ms.service_id, ms.title_id)

    @responses.activate
    def test_scrapes_correctly_for_award(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_award)

        self.assertIsNotNone(chapter_ids)
        chapter_ids = cast(set[int], chapter_ids)
        self.assertEqual(len(chapter_ids), 1)
        self.assertEqual(len(responses.calls), 1)

        inserted = self.dbutil.get_chapters(ms.manga_id, ms.service_id, limit=len(chapter_ids))
        self.assertEqual(len(inserted), 1)

        correct_chapter = Chapter(
            manga_id=ms.manga_id,
            service_id=ms.service_id,
            title="Apple to Orange",
            chapter_number=0,
            chapter_decimal=None,
            release_date=utcfromtimestamp(1681743600),
            chapter_identifier='1016128',
            group_id=self.group_id
        )

        self.assertDbChaptersEqual(inserted[0], correct_chapter)
        self.assertMangaServiceDisabled(ms.service_id, ms.title_id)

    @responses.activate
    def test_scrapes_correctly_for_creators(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_creators)

        self.assertIsNotNone(chapter_ids)
        chapter_ids = cast(set[int], chapter_ids)
        self.assertEqual(len(chapter_ids), 1)
        self.assertEqual(len(responses.calls), 1)

        inserted = self.dbutil.get_chapters(ms.manga_id, ms.service_id, limit=len(chapter_ids))
        self.assertEqual(len(inserted), 1)

        correct_chapter = Chapter(
            manga_id=ms.manga_id,
            service_id=ms.service_id,
            title="Hollow Grimoire (One-shot)",
            chapter_number=0,
            chapter_decimal=None,
            release_date=utcfromtimestamp(1708873200),
            chapter_identifier='1020458',
            group_id=self.group_id
        )

        self.assertDbChaptersEqual(inserted[0], correct_chapter)
        self.assertMangaServiceDisabled(ms.service_id, ms.title_id)

    @responses.activate
    def test_scrapes_correctly_for_hiatus(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_hiatus)

        self.assertIsNotNone(chapter_ids)
        chapter_ids = cast(set[int], chapter_ids)
        self.assertEqual(len(chapter_ids), 8)
        self.assertEqual(len(responses.calls), 1)

        self.assertMangaServiceEnabled(ms.service_id, ms.title_id)

        found = self.dbutil.get_manga_service(MangaPlus.ID, ms.title_id)
        # Hiatus manga should be checked roughly every 2 days
        self.assertDateGreater(found.next_update, utcnow() + timedelta(days=2))
        self.assertDateLess(found.next_update, utcnow() + timedelta(days=3))

    @responses.activate
    def test_parsing(self):
        title_id = 'test'
        responses.add(responses.GET, MangaPlus.API.format(title_id),
                      body=self.request_data_hiatus)
        resp = self.mangaplus.parse_series(title_id)
        self.assertEqual(len(responses.calls), 1)

        self.assertIsNotNone(resp)
        resp = cast(ResponseWrapper, resp)

        self.assertIsNone(resp.error_result)
        self.assertIsNone(resp.all_titles_view)
        self.assertIsNotNone(resp.success_result)
        self.assertIsNotNone(resp.title_detail_view)

        detail = resp.title_detail_view
        self.assertIsNotNone(detail)
        detail = cast(TitleDetailViewWrapper, detail)

        UpdateTiming = mangaplus_pb2.TitleDetailView.UpdateTiming
        self.assertEqual(detail.release_schedule, mangaplus_pb2.TitleLabels.ReleaseSchedule.WEEKLY)
        self.assertIsNone(detail.next_timestamp)
        self.assertEqual(detail.non_appearance_info, 'On a hiatus. Wait for it resuming.')
        self.assertEqual(detail.is_simul_release, True)
        self.assertEqual(detail.overview, "Gon might be a country boy, but he has high aspirations. Despite his Aunt Mito's protests, Gon decides to follow in his father's footsteps and become a legendary Hunter. The Hunter hopefuls begin their journey by storm-tossed ship, where Gon meets Leorio and Kurapika, the only other applicants who aren't devastated by bouts of seasickness. Having survived the terrors of the high seas, Gon and his companions now have to prove their worth in a variety of tests in order to find the elusive Exam Hall. And once they get there, will they ever leave alive...?")
        self.assertEqual(detail.update_timing, UpdateTiming.Name(UpdateTiming.NOT_REGULARLY))
        self.assertEqual(detail.viewing_period_description, 'The latest 3 chapters are viewable in this title.\nPlease be aware that the 3rd latest chapter will be hidden when a new chapter is added.')

        title = detail.title
        self.assertEqual(title.title_id, 100015)
        self.assertEqual(title.name, 'Hunter x Hunter')
        self.assertEqual(title.author, 'Yoshihiro Togashi')
        self.assertEqual(title.language, mangaplus_pb2.Title.Language.Name(mangaplus_pb2.Title.Language.ENGLISH))
        self.assertEqual(title.view_count, 0)

        self.assertTrue(title == title.title_id)
        self.assertTrue(title == title)
        self.assertFalse(title != title.title_id)
        self.assertEqual(str(title), f'{title.name} / {title.title_id}')

        chapter = detail.chapters[0]
        self.assertEqual(chapter.chapter_identifier, '1000338')
        self.assertEqual(chapter.name, '#001')
        self.assertEqual(chapter.title_id, '100015')
        self.assertEqual(chapter.title, 'Chapter 1: The Day of Departure')
        self.assertEqual(chapter.chapter_number, 1)
        self.assertEqual(chapter.group, 'Shueisha')
        self.assertEqual(chapter.chapter_title, 'Chapter 1: The Day of Departure')
        self.assertIsNone(chapter.decimal)
        self.assertRaises(ValueError, lambda: chapter.group_id)
        self.assertEqual(chapter.manga_title, 'Hunter x Hunter')
        self.assertEqual(chapter.manga_url, 'https://mangaplus.shueisha.co.jp/titles/100015')
        self.assertDatesEqual(chapter.release_date, utcfromtimestamp(1547996400))
        self.assertIsNone(chapter.volume)

    @responses.activate
    def test_parse_series_failed_request(self):
        title_id = 'test'
        responses.add(responses.GET, MangaPlus.API.format(title_id),
                      body=requests.RequestException())

        resp = self.mangaplus.parse_series(title_id)
        self.assertIsNone(resp)
        self.assertEqual(len(responses.calls), 1)

        responses.replace(responses.GET, MangaPlus.API.format(title_id),
                          json={}, status=400)

        resp = self.mangaplus.parse_series(title_id)
        self.assertIsNone(resp)
        self.assertEqual(len(responses.calls), 2)

    @responses.activate
    def test_parse_all_view(self):
        url = self.mangaplus.FEED_URL
        responses.add(responses.GET, url,
                      body=requests.RequestException())

        resp = self.mangaplus.get_all_titles(url)
        self.assertIsNone(resp)
        self.assertEqual(len(responses.calls), 1)

        responses.replace(responses.GET, url,
                          json={}, status=400)

        resp = self.mangaplus.get_all_titles(url)
        self.assertIsNone(resp)
        self.assertEqual(len(responses.calls), 2)

    @responses.activate
    def test_scrapes_correctly_for_notfound(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_notfound)

        self.assertIsNotNone(chapter_ids)
        chapter_ids = cast(set[int], chapter_ids)
        self.assertEqual(len(chapter_ids), 0)
        self.assertEqual(len(responses.calls), 1)

        self.assertMangaServiceDisabled(ms.service_id, ms.title_id)

    @responses.activate
    def test_scrape_service(self):
        all_ms_old = self.dbutil.get_service_manga(MangaPlus.ID)
        responses.add(responses.GET, MangaPlus.FEED_URL, body=self.request_data_all)
        retval = self.mangaplus.scrape_service(MangaPlus.ID, MangaPlus.FEED_URL, None)

        self.assertIsNone(retval)

        all_ms_new = self.dbutil.get_service_manga(MangaPlus.ID)
        self.assertGreater(len(all_ms_new), len(all_ms_old))
        self.assertEqual(len(all_ms_new), 160) # 158 new and 2 existing
        self.assertEqual(len(all_ms_old), 2) # 2 should exist

        found = self.dbutil.get_manga_service(MangaPlus.ID, '100056')
        self.assertIsNotNone(found)
        found = cast(MangaServiceWithId, found)
        self.assertEqual(found.title, 'SPY x FAMILY')
        self.assertEqual(found.disabled, False)
        self.assertEqual(found.release_interval, None)
        self.assertEqual(found.next_update, None)

        service_whole = self.dbutil.get_service_whole(MangaPlus.ID)
        self.assertDatesAlmostEqual(service_whole.last_check, utcnow())
        self.assertDateGreater(service_whole.next_update, utcnow() + timedelta(days=1))

    def test_set_checked_manga_true(self):
        service_id = MangaPlus.ID
        self.reset_service(service_id)

        self.mangaplus.set_checked(service_id, True)

        sw = self.dbutil.get_service_whole(service_id)
        self.assertIsNone(sw.next_update)

        s = self.dbutil.get_service(service_id)
        self.assertDateGreater(s.disabled_until, utcnow())
        self.assertDatesAlmostEqual(s.last_check, utcnow(), timedelta(seconds=3))

    def test_set_checked_manga_false(self):
        service_id = MangaPlus.ID
        self.reset_service(service_id)

        self.mangaplus.set_checked(service_id)

        sw = self.dbutil.get_service_whole(service_id)
        self.assertIsNotNone(sw.next_update)
        self.assertDateGreater(sw.next_update, utcnow() + timedelta(days=1))

        s = self.dbutil.get_service(service_id)
        self.assertDateGreater(s.disabled_until, utcnow())
        self.assertDatesAlmostEqual(s.last_check, utcnow(), timedelta(seconds=3))


@pytest.mark.parametrize('title, correct', [
    ('Bronze Award', (0, None)),
    ('Random string', (0, None)),
    ('One-shot', (1, None)),
    ('oneshot', (1, None)),
    ('one shot', (1, None)),
    ('ex', (0, 5)),
    ('#ex', (0, 5)),
    ('#10', (10, None)),
    ('Creators', (0, None)),
])

def test_parse_chapter(title: str, correct):
    assert MangaPlus.parse_chapter(title) == correct, f'MangaPlus.parse_title("{title}") did not equal {correct}'


if __name__ == '__main__':
    unittest.main()
