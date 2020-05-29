import logging
import re
from datetime import datetime, timedelta, timezone

import requests
from psycopg2.extras import execute_batch

from src.scrapers.base_scraper import BaseScraper, BaseChapter
from src.utils.utilities import random_timedelta
from .protobuf import mangaplus_pb2

logger = logging.getLogger('debug')


class TitleWrapper:
    def __init__(self, title: mangaplus_pb2.Title):
        self._title = title

    @property
    def title_id(self):
        return self._title.title_id

    @property
    def name(self):
        return self._title.name

    @property
    def author(self):
        return self._title.author

    @property
    def portrait_image_url(self):
        return self._title.portrait_image_url

    @property
    def landscape_image_url(self):
        return self._title.landscape_image_url

    @property
    def view_count(self):
        return self._title.view_count

    @property
    def language(self):
        return mangaplus_pb2.Language.Name(self._title.language)

    def to_dict(self):
        return {
            'title_id': self.title_id,
            'name': self.name,
            'author': self.author,
            'portrait_image_url': self.portrait_image_url,
            'landscape_image_url': self.landscape_image_url,
            'view_count': self.view_count,
            'language': self._title.language
        }


class TitleDetailViewWrapper:
    def __init__(self, title_detail: mangaplus_pb2.TitleDetailView):
        self._title_detail = title_detail

    @property
    def title(self):
        return TitleWrapper(self._title_detail.title)

    @property
    def title_image_url(self):
        return self._title_detail.title_image_url

    @property
    def overview(self):
        return self._title_detail.overview

    @property
    def background_image_url(self):
        return self._title_detail.background_image_url

    @property
    def next_timestamp(self):
        if self._title_detail.HasField('next_timestamp'):
            return datetime.utcfromtimestamp(self._title_detail.next_timestamp)

    @property
    def update_timing(self):
        return mangaplus_pb2.UpdateTiming.Name(self._title_detail.update_timing)

    @property
    def viewing_period_description(self):
        return self._title_detail.viewing_period_description

    @property
    def non_appearance_info(self):
        return self._title_detail.non_appearance_info

    @property
    def first_chapter_list(self):
        title_name = self.title.name
        return [ChapterWrapper(c, title_name) for c in
                self._title_detail.first_chapter_list]

    @property
    def last_chapter_list(self):
        title_name = self.title.name
        return [ChapterWrapper(c, title_name) for c in
                self._title_detail.last_chapter_list]

    @property
    def recommended_titles(self):
        return [TitleWrapper(t) for t in self._title_detail.recommended_titles]

    @property
    def is_simul_release(self):
        return self._title_detail.is_simul_release

    @property
    def chapters_descending(self):
        return self._title_detail.chapters_descending

    def to_dict(self):
        return {
            'title': self.title.to_dict(),
            'title_image_url': self.title_image_url,
            'overview': self.overview,
            'background_image_url': self.background_image_url,
            'next_timestamp': int(self.next_timestamp.replace(tzinfo=timezone.utc).timestamp()),  # timestamp returns in local timezone
            'update_timing': self._title_detail.update_timing,
            'viewing_period_description': self.viewing_period_description,
            'non_appearance_info': self.non_appearance_info,
            'first_chapter_list': [c.to_dict() for c in self.first_chapter_list],
            'last_chapter_list': [c.to_dict() for c in self.last_chapter_list],
            'recommended_title_list': [t.to_dict() for t in self.recommended_titles],
            'is_simul_released': self.is_simul_release
        }


class ResponseWrapper:
    def __init__(self, data):
        self._response = mangaplus_pb2.Response()
        self._response.ParseFromString(data)

    @property
    def success_result(self):
        if self._response.HasField('success_result'):
            return self._response.success_result

        return

    @property
    def error_result(self):
        if self._response.HasField('error_result'):
            return self._response.error_result

        return

    @property
    def title_detail_view(self):
        res = self.success_result
        if not res or not res.HasField('title_detail'):
            return

        return TitleDetailViewWrapper(res.title_detail)


class ChapterWrapper(BaseChapter):
    def __init__(self, chapter: mangaplus_pb2.Chapter, manga_title):
        self._chapter = chapter
        self._chapter_number = MangaPlus.parse_chapter(chapter.name)
        self._manga_title = manga_title

    @property
    def chapter_title(self):
        return self._chapter.sub_title

    @property
    def chapter_number(self):
        return self._chapter_number

    @property
    def volume(self):
        return None

    @property
    def decimal(self):
        return None

    @property
    def release_date(self):
        if self._chapter.HasField('start_timestamp'):
            return datetime.utcfromtimestamp(self._chapter.start_timestamp)

        return datetime.utcnow()

    @property
    def chapter_identifier(self):
        return self._chapter.chapter_id

    @property
    def title_id(self):
        return self._chapter.title_id

    @property
    def manga_title(self):
        return self._manga_title

    @property
    def manga_url(self):
        return MangaPlus.MANGA_URL.format(self.title_id)

    @property
    def group(self):
        return 'Shueisha'

    @property
    def title(self):
        return self.chapter_title

    def to_dict(self):
        return {
            'title_id': self.title_id,
            'chapter_id': self.chapter_identifier,
            'name': self._chapter.name,
            'sub_title': self.chapter_title,
            'thumbnail_url': self._chapter.thumbnail_url,
            'start_timestamp': int(self.release_date.replace(tzinfo=timezone.utc).timestamp()),  # timestamp returns in local timezone
            'end_timestamp': self._chapter.end_timestamp
        }


class MangaPlus(BaseScraper):
    API = 'https://jumpg-webapi.tokyo-cdn.com/api/title_detail?title_id={}'
    URL = 'https://mangaplus.shueisha.co.jp'
    MANGA_URL = 'https://mangaplus.shueisha.co.jp/titles/{}'
    CHAPTER_REGEX = re.compile(r'#(\d+)')
    CHAPTER_URL_FORMAT = 'https://mangaplus.shueisha.co.jp/viewer/{}'

    @staticmethod
    def min_update_interval():
        return random_timedelta(timedelta(minutes=15), timedelta(minutes=30))

    @staticmethod
    def parse_chapter(chapter_number):
        match = MangaPlus.CHAPTER_REGEX.match(chapter_number)
        if not match:
            raise ValueError('Invalid chapter number given')

        return int(match.groups()[0])

    def parse_series(self, title_id):
        try:
            r = requests.get(self.API.format(title_id))
        except requests.RequestException:
            logger.exception('Failed to fetch series')
            return False

        if r.status_code != 200:
            return False

        resp = ResponseWrapper(r.content)
        title_detail = resp.title_detail_view

        return title_detail

    def add_series(self, title_id):
        series = self.parse_series(title_id)
        if not series:
            return series

        sql = 'SELECT service_id FROM services WHERE url=%s'
        with self.conn:
            with self.conn.cursor() as cur:
                cur.execute(sql, (self.URL,))
                service_id = cur.fetchone()
                if not service_id:
                    logger.error('Could not find service id for Manga Plus')
                    return

                service_id = service_id[0]

                chapters = [*series.first_chapter_list, *series.last_chapter_list]

                for manga_id, _ in self.dbutil.add_new_series(cur,
                                                              {title_id: chapters},
                                                              service_id):
                    self.add_chapters(series, service_id, manga_id)

    def scrape_service(self, *args, **kwargs):
        pass

    def scrape_series(self, title_id, service_id, manga_id):
        series = self.parse_series(title_id)
        if not series:
            return series

        return self.add_chapters(series, service_id, manga_id)

    def add_chapters(self, series, service_id, manga_id):
        sql = 'INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_decimal, chapter_identifier, release_date, "group") ' \
              'VALUES (%s, %s, %s, %s, %s, %s, %s, \'Shueisha\') ON CONFLICT DO NOTHING '

        base_values = (manga_id, service_id)
        chapters = [*series.first_chapter_list, *series.last_chapter_list]
        data = [(*base_values, c.title, c.chapter_number, None,
                 c.chapter_identifier, c.release_date)
                for c in chapters]

        now = datetime.utcnow()
        next_update = now + timedelta(hours=4)
        disabled = False
        if series.next_timestamp:
            next_update = series.next_timestamp
        elif series.non_appearance_info:
            release_info = series.non_appearance_info.lower()
            if 'hiatus' in release_info:
                next_update = now + timedelta(days=1)
            elif 'completed' in release_info:
                next_update = None
                disabled = True

        newest_chapter = None
        for c in series.last_chapter_list:
            if not newest_chapter:
                newest_chapter = c
                continue

            if c.chapter_number > newest_chapter.chapter_number:
                newest_chapter = c

        with self.conn:
            with self.conn.cursor() as cursor:
                execute_batch(cursor, sql, data)

                sql = 'UPDATE manga_service SET last_check=%s, next_update=%s, disabled=%s WHERE manga_id=%s AND service_id=%s'
                cursor.execute(sql, [now, next_update, disabled, manga_id, service_id])
                if newest_chapter:
                    self.dbutil.update_latest_chapter(cursor, ((manga_id, newest_chapter.chapter_number, newest_chapter.release_date),))

        return True
