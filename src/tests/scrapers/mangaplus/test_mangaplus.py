import os
import unittest
from datetime import timedelta
from typing import override

import pytest
import requests
import responses

from src.db.models.chapter import Chapter
from src.db.models.manga import MangaServiceWithId
from src.scrapers.mangaplus.mangaplus import MangaPlus
from src.scrapers.mangaplus.protobuf import mangaplus_pb2
from src.tests.testing_utils import BaseTestClasses, spy_on
from src.utils.utilities import utcfromtimestamp, utcnow


def find_dict_inequality(d1: dict, d2: dict) -> bool:
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

    @override
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
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

    @override
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

        assert chapter_ids is not None
        assert len(chapter_ids) == 14
        assert len(responses.calls) == 1

        inserted = self.dbutil.get_chapters(ms.manga_id, ms.service_id, limit=len(chapter_ids))

        last_chapter: Chapter | None = None
        for c in inserted:
            if c.chapter_number == 124:
                last_chapter = c
                break

        assert last_chapter is not None

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
        assert ms is not None
        self.assertDatesEqual(ms.next_update, utcfromtimestamp(1697468400))

    @responses.activate
    def test_scrapes_correctly_for_existing_chapters(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_existing)

        assert chapter_ids is not None
        assert len(chapter_ids) == 2
        assert len(responses.calls) == 1
        self.assertMangaServiceDisabled(ms.service_id, ms.title_id)  # It is completed

    @responses.activate
    def test_scrapes_correctly_for_complete_chapters(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_complete)

        assert chapter_ids is not None
        assert len(chapter_ids) == 5
        assert len(responses.calls) == 1

        inserted = self.dbutil.get_chapters(ms.manga_id, ms.service_id, limit=len(chapter_ids))

        inserted.sort(key=lambda c: c.chapter_number)

        correct_chapters = [
            Chapter(
                manga_id=ms.manga_id,
                service_id=ms.service_id,
                title='Cruelty',
                chapter_number=1,
                chapter_decimal=None,
                release_date=utcfromtimestamp(1547996400),
                chapter_identifier='1000303',
                group_id=self.group_id,
            ),
            Chapter(
                manga_id=ms.manga_id,
                service_id=ms.service_id,
                title='The Stranger',
                chapter_number=2,
                chapter_decimal=None,
                release_date=utcfromtimestamp(1547996400),
                chapter_identifier='1000304',
                group_id=self.group_id,
            ),
            Chapter(
                manga_id=ms.manga_id,
                service_id=ms.service_id,
                title='To Return By Dawn Without Fail',
                chapter_number=3,
                chapter_decimal=None,
                release_date=utcfromtimestamp(1547996400),
                chapter_identifier='1000305',
                group_id=self.group_id,
            ),
            Chapter(
                manga_id=ms.manga_id,
                service_id=ms.service_id,
                title="Tanjiro's Journal, Part 1",
                chapter_number=4,
                chapter_decimal=None,
                release_date=utcfromtimestamp(1547996400),
                chapter_identifier='1000306',
                group_id=self.group_id,
            ),
            Chapter(
                manga_id=ms.manga_id,
                service_id=ms.service_id,
                title='Special one shot ',
                chapter_number=4,
                chapter_decimal=5,
                release_date=utcfromtimestamp(1633363200),
                chapter_identifier='1006664',
                group_id=self.group_id,
            ),
        ]

        def sort_key(chapter: Chapter) -> str:
            return chapter.chapter_identifier

        for ch, correct in zip(sorted(inserted, key=sort_key), correct_chapters, strict=True):
            self.assertDbChaptersEqual(ch, correct)

        self.assertMangaServiceDisabled(ms.service_id, ms.title_id)

    @responses.activate
    def test_scrapes_correctly_for_other_schedule_chapters(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_otherschedule)

        assert chapter_ids is not None
        assert len(chapter_ids) == 1
        assert len(responses.calls) == 1

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

        assert chapter_ids is not None
        assert len(chapter_ids) == 1
        assert len(responses.calls) == 1

        inserted = self.dbutil.get_chapters(ms.manga_id, ms.service_id, limit=len(chapter_ids))
        assert len(inserted) == 1

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

        assert chapter_ids is not None
        assert len(chapter_ids) == 1
        assert len(responses.calls) == 1

        inserted = self.dbutil.get_chapters(ms.manga_id, ms.service_id, limit=len(chapter_ids))
        assert len(inserted) == 1

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

        assert chapter_ids is not None
        assert len(chapter_ids) == 1
        assert len(responses.calls) == 1

        inserted = self.dbutil.get_chapters(ms.manga_id, ms.service_id, limit=len(chapter_ids))
        assert len(inserted) == 1

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

        assert chapter_ids is not None
        assert len(chapter_ids) == 8
        assert len(responses.calls) == 1

        self.assertMangaServiceEnabled(ms.service_id, ms.title_id)

        found = self.dbutil.get_manga_service(MangaPlus.ID, ms.title_id)
        assert found is not None
        # Hiatus manga should be checked roughly every 2 days
        self.assertDateGreater(found.next_update, utcnow() + timedelta(days=2))
        self.assertDateLess(found.next_update, utcnow() + timedelta(days=3))

    @responses.activate
    def test_parsing(self):
        title_id = 'test'
        responses.add(responses.GET, MangaPlus.API.format(title_id),
                      body=self.request_data_hiatus)
        resp = self.mangaplus.parse_series(title_id)
        assert len(responses.calls) == 1

        assert resp is not None

        assert resp.error_result is None
        assert resp.all_titles_view is None
        assert resp.success_result is not None
        assert resp.title_detail_view is not None

        detail = resp.title_detail_view
        assert detail is not None

        UpdateTiming = mangaplus_pb2.TitleDetailView.UpdateTiming
        assert detail.release_schedule == mangaplus_pb2.TitleLabels.ReleaseSchedule.WEEKLY
        assert detail.next_timestamp is None
        assert detail.non_appearance_info == 'On a hiatus. Wait for it resuming.'
        assert detail.is_simul_release is True
        assert detail.overview == "Gon might be a country boy, but he has high aspirations. Despite his Aunt Mito's protests, Gon decides to follow in his father's footsteps and become a legendary Hunter. The Hunter hopefuls begin their journey by storm-tossed ship, where Gon meets Leorio and Kurapika, the only other applicants who aren't devastated by bouts of seasickness. Having survived the terrors of the high seas, Gon and his companions now have to prove their worth in a variety of tests in order to find the elusive Exam Hall. And once they get there, will they ever leave alive...?"
        assert detail.update_timing == UpdateTiming.Name(UpdateTiming.NOT_REGULARLY)
        assert detail.viewing_period_description == 'The latest 3 chapters are viewable in this title.\nPlease be aware that the 3rd latest chapter will be hidden when a new chapter is added.'

        title = detail.title
        assert title.title_id == 100015
        assert title.name == 'Hunter x Hunter'
        assert title.author == 'Yoshihiro Togashi'
        assert title.language == mangaplus_pb2.Title.Language.Name(mangaplus_pb2.Title.Language.ENGLISH)
        assert title.view_count == 0

        assert title == title.title_id
        assert title == title
        assert not title != title.title_id
        assert str(title) == f'{title.name} / {title.title_id}'

        chapter = detail.chapters[0]
        assert chapter.chapter_identifier == '1000338'
        assert chapter.name == '#001'
        assert chapter.title_id == '100015'
        assert chapter.title == 'Chapter 1: The Day of Departure'
        assert chapter.chapter_number == 1
        assert chapter.group == 'Shueisha'
        assert chapter.chapter_title == 'Chapter 1: The Day of Departure'
        assert chapter.decimal is None
        with pytest.raises(ValueError):
            chapter.group_id
        assert chapter.manga_title == 'Hunter x Hunter'
        assert chapter.manga_url == 'https://mangaplus.shueisha.co.jp/titles/100015'
        self.assertDatesEqual(chapter.release_date, utcfromtimestamp(1547996400))
        assert chapter.volume is None

    @responses.activate
    def test_parse_series_failed_request(self):
        title_id = 'test'
        responses.add(responses.GET, MangaPlus.API.format(title_id),
                      body=requests.RequestException())

        resp = self.mangaplus.parse_series(title_id)
        assert resp is None
        assert len(responses.calls) == 1

        responses.replace(responses.GET, MangaPlus.API.format(title_id),
                          json={}, status=400)

        resp = self.mangaplus.parse_series(title_id)
        assert resp is None
        assert len(responses.calls) == 2

    @responses.activate
    def test_parse_all_view(self):
        url = self.mangaplus.FEED_URL
        responses.add(responses.GET, url,
                      body=requests.RequestException())

        resp = self.mangaplus.get_all_titles(url)
        assert resp is None
        assert len(responses.calls) == 1

        responses.replace(responses.GET, url,
                          json={}, status=400)

        resp = self.mangaplus.get_all_titles(url)
        assert resp is None
        assert len(responses.calls) == 2

    @responses.activate
    def test_scrapes_correctly_for_notfound(self):
        ms, chapter_ids = self.setup_with_data(self.request_data_notfound)

        assert chapter_ids is not None
        assert len(chapter_ids) == 0
        assert len(responses.calls) == 1

        self.assertMangaServiceDisabled(ms.service_id, ms.title_id)

    @responses.activate
    def test_scrape_service(self):
        all_ms_old = self.dbutil.get_service_manga(MangaPlus.ID)
        responses.add(responses.GET, MangaPlus.FEED_URL, body=self.request_data_all)
        retval = self.mangaplus.scrape_service(MangaPlus.ID, MangaPlus.FEED_URL, None)

        assert retval is None

        all_ms_new = self.dbutil.get_service_manga(MangaPlus.ID)
        assert len(all_ms_new) > len(all_ms_old)
        assert len(all_ms_new) == 160 # 158 new and 2 existing
        assert len(all_ms_old) == 2 # 2 should exist

        found = self.dbutil.get_manga_service(MangaPlus.ID, '100056')
        assert found is not None
        assert found.title == 'SPY x FAMILY'
        assert found.disabled is False
        assert found.release_interval is None
        assert found.next_update is None

        service_whole = self.dbutil.get_service_whole(MangaPlus.ID)
        assert service_whole is not None
        self.assertDatesAlmostEqual(service_whole.last_check, utcnow())
        self.assertDateGreater(service_whole.next_update, utcnow() + timedelta(days=1))

    def test_set_checked_manga_true(self):
        service_id = MangaPlus.ID
        self.reset_service(service_id)

        self.mangaplus.set_checked(service_id, True)

        sw = self.dbutil.get_service_whole(service_id)
        assert sw is not None
        assert sw.next_update is None

        s = self.dbutil.get_service(service_id)
        assert s is not None
        self.assertDateGreater(s.disabled_until, utcnow())
        self.assertDatesAlmostEqual(s.last_check, utcnow(), timedelta(seconds=3))

    def test_set_checked_manga_false(self):
        service_id = MangaPlus.ID
        self.reset_service(service_id)

        self.mangaplus.set_checked(service_id)

        sw = self.dbutil.get_service_whole(service_id)
        assert sw is not None
        assert sw.next_update is not None
        self.assertDateGreater(sw.next_update, utcnow() + timedelta(days=1))

        s = self.dbutil.get_service(service_id)
        assert s is not None
        self.assertDateGreater(s.disabled_until, utcnow())
        self.assertDatesAlmostEqual(s.last_check, utcnow(), timedelta(seconds=3))


@pytest.mark.parametrize(('title', 'correct'), [
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

def test_parse_chapter(title: str, correct: tuple[int, int | None]):
    assert MangaPlus.parse_chapter(title) == correct, f'MangaPlus.parse_title("{title}") did not equal {correct}'


if __name__ == '__main__':
    unittest.main()
