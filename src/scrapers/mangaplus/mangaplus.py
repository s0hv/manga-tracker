import logging
import re
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Tuple, Set

import psycopg
import requests

from src.db.mappers.chapter_mapper import ChapterMapper, Chapter as ChapterModel
from src.db.models.authors import AuthorPartial
from src.db.models.manga import MangaService
from src.enums import Status
from src.scrapers.base_scraper import (BaseChapter, BaseScraperWhole,
                                       BaseScraper, ScrapeServiceRetVal)
from src.utils.utilities import random_timedelta, utcnow, utcfromtimestamp
from .protobuf import mangaplus_pb2

logger = logging.getLogger('debug')


class UpdateTiming(Enum):
    NOT_REGULARLY = 'NOT_REGULARLY'


class TitleWrapper:
    def __init__(self, title: mangaplus_pb2.Title):
        self._title = title

    @property
    def title_id(self) -> int:
        return self._title.title_id

    @property
    def name(self) -> str:
        return self._title.name

    @property
    def author(self) -> str:
        return self._title.author

    @property
    def view_count(self) -> Optional[int]:
        return self._title.view_count

    @property
    def language(self) -> str:
        return mangaplus_pb2.Title.Language.Name(self._title.language)

    def __str__(self):
        return f'{self.name} / {self.title_id}'

    def __hash__(self):
        return hash(self.title_id)

    def __eq__(self, other):
        if isinstance(other, TitleWrapper):
            return other.title_id == self.title_id
        else:
            return self.title_id == other

    def __ne__(self, other):
        return not self.__eq__(other)


class TitleDetailViewWrapper:
    def __init__(self, title_detail: mangaplus_pb2.TitleDetailView):
        self._title_detail = title_detail

    @property
    def title(self) -> TitleWrapper:
        return TitleWrapper(self._title_detail.title)

    @property
    def overview(self) -> Optional[str]:
        return self._title_detail.overview

    @property
    def next_timestamp(self) -> Optional[datetime]:
        if self._title_detail.next_timestamp:
            return utcfromtimestamp(self._title_detail.next_timestamp)
        else:
            return None

    @property
    def update_timing(self) -> str:
        return mangaplus_pb2.TitleDetailView.UpdateTiming.Name(self._title_detail.update_timing)

    @property
    def viewing_period_description(self) -> Optional[str]:
        return self._title_detail.viewing_period_description

    @property
    def non_appearance_info(self) -> Optional[str]:
        return self._title_detail.non_appearance_info

    @property
    def chapters(self) -> List['ChapterWrapper']:
        title_name = self.title.name

        def flatten(chapters_view: mangaplus_pb2.ChaptersView):
            yield from chapters_view.first_chapter_list
            yield from chapters_view.unavailable_chapter_list
            yield from chapters_view.last_chapter_list

        return [ChapterWrapper(c, title_name)
                for ch_cont in self._title_detail.chapters
                for c in flatten(ch_cont)]

    @property
    def is_simul_release(self) -> Optional[bool]:
        return self._title_detail.is_simul_release

    @property
    def release_schedule(self):
        labels = self._title_detail.title_labels
        if labels:
            return labels.release_schedule


class AllTitlesViewWrapper:
    def __init__(self, all_titles: mangaplus_pb2.AllTitlesView):
        self._all_titles = all_titles

    @property
    def titles(self) -> List[TitleWrapper]:
        return [TitleWrapper(title)
                for variant in self._all_titles.title_variants
                for title in variant.title
                if title.language == mangaplus_pb2.Title.Language.ENGLISH]


class ResponseWrapper:
    def __init__(self, data):
        self._response = mangaplus_pb2.Response()
        self._response.ParseFromString(data)

    @property
    def success_result(self) -> Optional[mangaplus_pb2.SuccessResult]:
        if self._response.HasField('success_result'):
            return self._response.success_result
        else:
            return None

    @property
    def error_result(self) -> Optional[mangaplus_pb2.ErrorResult]:
        if self._response.HasField('error_result'):
            return self._response.error_result
        else:
            return None

    @property
    def title_detail_view(self) -> Optional[TitleDetailViewWrapper]:
        res = self.success_result
        if not res or not res.HasField('title_detail'):
            return None

        return TitleDetailViewWrapper(res.title_detail)

    @property
    def all_titles_view(self) -> Optional[AllTitlesViewWrapper]:
        res = self.success_result
        if not res or not res.HasField('all_titles'):
            return None

        return AllTitlesViewWrapper(res.all_titles)


class ChapterWrapper(BaseChapter):
    def __init__(self, chapter: mangaplus_pb2.Chapter, manga_title: str, group_id: Optional[int] = None):
        self._chapter = chapter
        self._chapter_number, self._chapter_decimal = MangaPlus.parse_chapter(chapter.name)
        self._manga_title = manga_title
        self._group_id = group_id

    @property
    def chapter_title(self) -> Optional[str]:
        return self._chapter.sub_title

    @property
    def name(self) -> str:
        return self._chapter.name

    @property
    def chapter_number(self) -> int:
        return self._chapter_number

    @property
    def volume(self) -> None:
        return None

    @property
    def decimal(self) -> Optional[int]:
        return self._chapter_decimal

    @property
    def release_date(self) -> datetime:
        if self._chapter.start_timestamp:
            return utcfromtimestamp(self._chapter.start_timestamp)

        return utcnow()

    @property
    def chapter_identifier(self) -> str:
        return str(self._chapter.chapter_id)

    @property
    def title_id(self) -> str:
        return str(self._chapter.title_id)

    @property
    def manga_title(self) -> str:
        return self._manga_title

    @property
    def manga_url(self) -> str:
        return MangaPlus.MANGA_URL.format(self.title_id)

    @property
    def group(self) -> str:
        return MangaPlus.GROUP

    @property
    def group_id(self) -> int:
        if self._group_id is None:
            raise ValueError('Group id is None')
        return self._group_id

    @group_id.setter
    def group_id(self, value: int):
        self._group_id = value

    @property
    def title(self) -> str:
        return self.chapter_title or ''


class MangaPlus(BaseScraperWhole):
    ID = 1
    NAME = 'MANGA Plus'
    API = 'https://jumpg-webapi.tokyo-cdn.com/api/title_detailV3?title_id={}'
    FEED_URL = 'https://jumpg-webapi.tokyo-cdn.com/api/title_list/allV2'
    URL = 'https://mangaplus.shueisha.co.jp'
    MANGA_URL = 'https://mangaplus.shueisha.co.jp/titles/{}'
    CHAPTER_REGEX = re.compile(r'#(\d+)')
    SPECIAL_CHAPTER_REGEX = re.compile(r'\s*(#?ex)s*', re.I)
    ONESHOT_REGEX = re.compile(r'\s*(one[- ]?shot)s*', re.I)
    AWARD_REGEX = re.compile(r'\s*bronze award(\s|:)*', re.I)
    CHAPTER_URL_FORMAT = 'https://mangaplus.shueisha.co.jp/viewer/{}'
    MANGA_URL_FORMAT = 'https://mangaplus.shueisha.co.jp/titles/{}'
    GROUP = 'Shueisha'

    def min_update_interval(self) -> timedelta:
        return random_timedelta(timedelta(minutes=10), timedelta(minutes=20))

    @staticmethod
    def parse_chapter(chapter_number) -> Tuple[int, Optional[int]]:
        match = MangaPlus.CHAPTER_REGEX.match(chapter_number)
        if not match:
            match = MangaPlus.SPECIAL_CHAPTER_REGEX.match(chapter_number)
            if match:
                return 0, 5

            match = MangaPlus.ONESHOT_REGEX.match(chapter_number)
            if match:
                return 1, None

            logger.warning(f'Chapter number {chapter_number} could not be parsed. Treating it as chapter 0.')

            return 0, None

        return int(match.groups()[0]), None

    @staticmethod
    def parse_series(title_id: str) -> Optional[ResponseWrapper]:
        try:
            r = requests.get(MangaPlus.API.format(title_id))
        except requests.RequestException:
            logger.exception('Failed to fetch series')
            return None

        if not r.ok:
            return None

        return ResponseWrapper(r.content)

    @staticmethod
    def get_all_titles(api_url: str) -> Optional[AllTitlesViewWrapper]:
        try:
            r = requests.get(api_url)
        except requests.RequestException:
            logger.exception('Failed to fetch all mangaplus titles')
            return None

        if not r.ok:
            return None

        resp = ResponseWrapper(r.content)
        all_titles = resp.all_titles_view

        return all_titles

    def scrape_service(self, service_id: int, feed_url: str,
                       last_update: Optional[datetime], title_id: Optional[str] = None) -> Optional[ScrapeServiceRetVal]:
        self.dbutil.update_service_whole(service_id, timedelta(days=1) + self.min_update_interval())
        all_titles = self.get_all_titles(feed_url)
        if not all_titles:
            return None

        titles = all_titles.titles
        if not titles:
            return None

        existing_titles = self.dbutil.get_service_manga(service_id)
        existing_title_ids = {int(t.title_id) for t in existing_titles}
        new_titles = set(titles).difference(existing_title_ids)
        if not new_titles:
            return None

        logger.info(f'{len(new_titles)} new manga to be added to mangaplus')
        self.dbutil.add_new_manga_and_check_duplicate_titles([
            MangaService(
                service_id=service_id,
                disabled=False,
                title_id=str(t.title_id),
                title=t.name,
                manga_id=None
            )
            for t in new_titles
        ])

        # Does not add chapters. Only adds new manga
        return None

    def scrape_series(self, title_id: str, service_id: int, manga_id: int,
                      feed_url=None) -> Optional[Set[int]]:
        parsed = self.parse_series(title_id)
        if parsed is None:
            return None

        # If manga has been removed and returns not found disabled it.
        if parsed.error_result and parsed.error_result.english_popup.subject.lower() == 'not found':
            logger.info(f'MANGA Plus API returned not found for {title_id}. Disabling it.')
            self.dbutil.disable_manga_service(service_id, title_id)
            return set()

        series = parsed.title_detail_view
        if not isinstance(series, TitleDetailViewWrapper):
            return series

        return self.add_chapters(series, service_id, manga_id)

    def add_chapters(self, series: TitleDetailViewWrapper, service_id: int, manga_id: int) -> Optional[Set[int]]:
        group = self.dbutil.get_or_create_group(self.GROUP)

        group_id = group.group_id
        chapters: List[ChapterWrapper] = series.chapters

        # Update chapter number for special chapters
        prev_chapter = None
        for c in chapters:
            c.group_id = group_id
            if not prev_chapter:
                prev_chapter = c
                continue

            if c.decimal is None or c.chapter_number:
                prev_chapter = c
                continue

            c._chapter_number = prev_chapter.chapter_number

        entries = self.get_new_entries(service_id, chapters) or []

        new_chapters: List[ChapterModel] = []
        for chapter in entries:
            new_chapters.append(
                ChapterMapper.base_chapter_to_db(chapter, manga_id, service_id, strip_chapter_prefix=True)
            )

        now = utcnow()
        next_update: Optional[datetime] = now + timedelta(hours=12) + self.min_update_interval()
        disabled = False
        completed = False
        if series.next_timestamp:
            next_update = series.next_timestamp
        elif series.non_appearance_info:
            release_info = series.non_appearance_info.lower()
            if 'hiatus' in release_info:
                next_update = now + timedelta(days=2) + self.min_update_interval()
            elif 'completed' in release_info:
                next_update = None
                disabled = True
                completed = True
        # Disable one shots
        elif series.update_timing == UpdateTiming.NOT_REGULARLY.value and chapters:
            if self.ONESHOT_REGEX.match(chapters[0].name) or self.AWARD_REGEX.match(chapters[0].name):
                logger.info(f'One shot or award chapter found for {self.NAME} title {series.title.name} / {series.title.title_id}. Disabling it.')
                next_update = None
                disabled = True
                completed = True

        if series.release_schedule:
            ReleaseSchedule = mangaplus_pb2.TitleLabels.ReleaseSchedule
            if series.release_schedule in (ReleaseSchedule.COMPLETED, ReleaseSchedule.DISABLED, ReleaseSchedule.OTHER):
                next_update = None
                disabled = True
                completed = False

            if series.release_schedule == ReleaseSchedule.OTHER:
                logger.warning(f'Release schedule is OTHER for {self.NAME} title {series.title.name} / {series.title.title_id}. Disabling it.')

        newest_chapter = None
        for c in chapters:
            if not newest_chapter:
                newest_chapter = c
                continue

            if c.chapter_number > newest_chapter.chapter_number:
                newest_chapter = c

        with self.conn.transaction():
            with self.conn.cursor() as cursor:
                inserted = self.dbutil.add_chapters(new_chapters, fetch=True)

                sql = 'UPDATE manga_service SET last_check=%s, next_update=%s, disabled=%s WHERE manga_id=%s AND service_id=%s'
                cursor.execute(sql, [now, next_update, disabled, manga_id, service_id])
                if newest_chapter:
                    self.dbutil.update_latest_chapter(((manga_id, newest_chapter.chapter_number, newest_chapter.release_date),), cur=cursor)

                if completed:
                    sql = 'INSERT INTO manga_info (manga_id, status) VALUES (%s, %s) ON CONFLICT (manga_id) DO UPDATE SET status=EXCLUDED.status'
                    cursor.execute(sql, (manga_id, Status.COMPLETED))

                # Add manga authors if necessary
                authors = series.title.author.split(' / ')
                author = AuthorPartial(name=authors[0])
                artist = None
                if len(authors) > 1:
                    # Sometimes artist name starts with art by
                    art_by = 'art by '
                    if authors[1].lower().startswith(art_by):
                        artist = AuthorPartial(name=authors[1][len(art_by):])
                    else:
                        artist = AuthorPartial(name=authors[1])
                self.dbutil.add_manga_author_artist_if_not_exist(
                    manga_id,
                    author,
                    artist,
                    cur=cursor
                )

        return {c.chapter_id for c in inserted}

    def set_checked(self, service_id: int, is_manga: bool = False) -> None:
        """
        Mangaplus new series checks should only be done seldom
        """
        try:
            BaseScraper.set_checked(self, service_id)
            if not is_manga:
                self.dbutil.update_service_whole(service_id, self.CONFIG.check_interval)
        except psycopg.Error:
            logger.exception(f'Failed to update service disabled time for {self.NAME} {service_id}')
