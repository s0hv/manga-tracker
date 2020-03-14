import logging
import re
from datetime import datetime, timedelta

import requests
from psycopg2.extras import execute_batch

from src.scrapers.base_scraper import BaseScraper

logger = logging.getLogger('debug')


class BaseObject:
    def __init__(self, data, pos=0):
        self.data = data or []
        self.pos = pos

    @property
    def current_value(self):
        return self.data[self.pos]

    def inc(self):
        self.pos += 1

    def bool(self):
        return self.uint32() != 0

    def uint32(self):
        t = 127 & self.current_value
        if self.current_value < 128:
            self.inc()
            return t

        self.inc()
        t = t | (127 & self.current_value) << 7
        if self.current_value < 128:
            self.inc()
            return t

        self.inc()
        t = t | (127 & self.current_value) << 14
        if self.current_value < 128:
            self.inc()
            return t

        self.inc()
        t = t | (127 & self.current_value) << 21
        if self.current_value < 128:
            self.inc()
            return t

        self.inc()
        t = t | (15 & self.current_value) << 28
        if self.current_value < 128:
            self.inc()
            return t

        self.pos += 6
        if self.pos > len(self.data):
            raise IndexError(f'Index out of range {self.pos} + 11 > {len(self.data)}')

        return t

    def string(self):
        t = self.uint32()
        p = self.pos
        self.pos += t
        return bytes(self.data[p:self.pos]).decode('utf-8')

    def skip_type(self, i):
        if i == 0:
            self.skip()
        elif i == 1:
            self.skip(8)
        elif i == 2:
            self.skip(self.uint32())
        elif i == 3:
            t = 7 & self.uint32()
            while 4 != t:
                self.skip_type(t)
        elif i == 5:
            self.skip(4)

    def skip(self, n=None):
        if n is not None:
            self.pos += n
        else:
            cond = 128 & self.current_value
            self.inc()
            while cond:
                cond = 128 & self.current_value
                self.inc()

    @staticmethod
    def compare_obj(a: dict, b: dict, ignore_when_none=False):
        for k, v in a.items():
            if k not in b:
                continue

            v2 = b.pop(k)

            if ignore_when_none and v2 is None:
                continue
            elif v != v2:
                return False
            elif isinstance(v2, list):
                for aval, bval in zip(v, v2):
                    if not Series.compare_obj(aval, bval, ignore_when_none):
                        return False

            elif isinstance(v2, dict):
                Series.compare_obj(v, v2, ignore_when_none)

        return True


class Title(BaseObject):
    def __init__(self, data, pos=0):
        super().__init__(data, pos)
        self.title_id = None
        self.name = None
        self.author = None
        self.portrait_image_url = None
        self.landscape_image_url = None
        self.view_count = None
        self.language = None

    def __dict__(self):
        return {
            "title_id": self.title_id,
            "name": self.name,
            "author": self.author,
            "portrait_image_url": self.portrait_image_url,
            "landscape_image_url": self.landscape_image_url,
            "view_count": self.view_count,
            "language": self.language
        }

    @classmethod
    def decode(cls, base: BaseObject):
        t = base.uint32()
        n = len(base.data) if t == 0 else base.pos + t
        title = cls(None, base.pos)
        while base.pos < n:
            i_ = base.uint32()
            i = i_ >> 3
            if i == 1:
                title.title_id = base.uint32()
            elif i == 2:
                title.name = base.string()
            elif i == 3:
                title.author = base.string()
            elif i == 4:
                title.portrait_image_url = base.string()
            elif i == 5:
                title.landscape_image_url = base.string()
            elif i == 6:
                title.view_count = base.uint32()
            elif i == 7:
                title.language = base.uint32()
            else:
                base.skip_type(7 & i_)

        return title


class Chapter(BaseObject):
    URL = 'https://mangaplus.shueisha.co.jp/viewer/{}'

    def __init__(self, data, pos=0):
        super().__init__(data, pos)
        self.title_id = None
        self.chapter_id = None
        self.name = None
        self.sub_title = None
        self.thumbnail_url = None
        self.start_timestamp = None
        self.end_timestammp = None
        self.already_viewed = None
        self.is_vertical_only = None

    def __dict__(self):
        return {
            "title_id": self.title_id,
            "chapter_id": self.chapter_id,
            "name": self.name,
            "sub_title": self.sub_title,
            "thumbnail_url": self.thumbnail_url,
            "start_timestamp": self.start_timestamp,
            "end_timestamp": self.end_timestammp,
            "already_viewed": self.already_viewed,
            "is_vertical_only": self.is_vertical_only
        }

    @property
    def url(self):
        return self.URL.format(self.chapter_id)

    @classmethod
    def decode(cls, base: BaseObject):
        t = base.uint32()
        n = len(base.data) if t == 0 else base.pos + t
        chp = Chapter(None, base.pos)
        while base.pos < n:
            i_ = base.uint32()
            i = i_ >> 3

            if i == 1:
                chp.title_id = base.uint32()
            elif i == 2:
                chp.chapter_id = base.uint32()
            elif i == 3:
                chp.name = base.string()
            elif i == 4:
                chp.sub_title = base.string()
            elif i == 5:
                chp.thumbnail_url = base.string()
            elif i == 6:
                chp.start_timestamp = base.uint32()
            elif i == 7:
                chp.end_timestammp = base.uint32()
            elif i == 8:
                chp.already_viewed = base.bool()
            elif i == 9:
                chp.is_vertical_only = base.bool()
            else:
                base.skip_type(7 & i_)

        return chp


class Series(BaseObject):
    """
    Reverse engineered the jump api in order to parse the result
    """

    TITLE = 1
    TITLE_IMAGE_URL = 2
    OVERVIEW = 3
    BG_IMAGE_URL = 4
    NEXT_TIMESTAMP = 5
    UPDATE_TIMING = 6
    VIEWING_PERIOD_DESCRIPTION = 7
    NON_APPEARANCE_INFO = 8
    FIRST_CHAPTER_LIST = 9
    LAST_CHAPTER_LIST = 10
    BANNER = 11
    RECOMMENDED_TITLE_LIST = 12
    SNS = 13
    IS_SIMUL_RELEASE = 14
    IS_SUBSCRIBED = 15
    RATING = 16
    CHAPTERS_DESCENDING = 17
    NUMBER_OF_VIEWS = 18

    def __init__(self, data, pos=0):
        super().__init__(data, pos)

        self.title = None
        self.title_image_url = None
        self.overview = None
        self.background_image_url = None
        self.next_timestamp = None
        self.update_timing = None
        self.viewing_period_description = None
        self.non_appearance_info = None
        self.first_chapter_list = []
        self.last_chapter_list = []
        self.banners = []
        self.recommended_title_list = []
        self.sns = None
        self.is_simul_released = None
        self.is_subscribed = None
        self.rating = None
        self.chapters_descending = None
        self.number_of_views = None

    def __repr__(self):
        return f'<mangaplus.Series> {self.title.name}'

    def __dict__(self):
        return {
            "title": self.title.__dict__(),
            "title_image_url": self.title_image_url,
            "overview": self.overview,
            "background_image_url": self.background_image_url,
            "next_timestamp": self.next_timestamp,
            "update_timing": self.update_timing,
            "viewing_period_description": self.viewing_period_description,
            "non_appearance_info": self.non_appearance_info,
            "first_chapter_list": [chapter.__dict__() for chapter in self.first_chapter_list],
            "last_chapter_list": [chapter.__dict__() for chapter in self.last_chapter_list],
            "banners": [banner.__dict__() for banner in self.banners],
            "recommended_title_list": [title.__dict__() for title in self.recommended_title_list],
            "sns": self.sns,
            "is_simul_released": self.is_simul_released,
            "is_subscribed": self.is_subscribed,
            "rating": self.rating,
            "chapters_descending": self.chapters_descending,
            "number_of_views": self.number_of_views
        }

    def __cmp__(self, other, ignore_when_none=False):
        d = self.__dict__()
        if isinstance(other, Series):
            other = other.__dict__()
        elif isinstance(other, dict):
            pass
        else:
            raise TypeError('Compared object must be Series or dict')

        return self.compare_obj(d, other)

    def decode(self, wanted_features: set=None):
        if not self.data:
            return

        i = self.uint32()
        status = i >> 3
        if status != 1:
            # TODO error parsing?
            raise ValueError("Data is invalid")

        t = self.uint32()
        nn = len(self.data) if t == 0 else self.pos + t
        while self.pos < nn:
            i_ = self.uint32()
            i = i_ >> 3

            if i != 8:
                self.uint32()
                continue

            t2 = self.uint32()
            n = len(self.data) if t2 == 0 else self.pos + t2
            while self.pos < n:
                i2_ = self.uint32()
                i2 = i2_ >> 3

                if wanted_features and i2 not in wanted_features:
                    self.skip_type(7 & i2_)
                    continue

                if i2 == 1:
                    self.title = Title.decode(self)
                elif i2 == 2:
                    self.title_image_url = self.string()
                elif i2 == 3:
                    self.overview = self.string()
                elif i2 == 4:
                    self.background_image_url = self.string()
                elif i2 == 5:
                    self.next_timestamp = self.uint32()
                elif i2 == 6:
                    self.update_timing = self.uint32()
                elif i2 == 7:
                    self.viewing_period_description = self.string()
                elif i2 == 8:
                    self.non_appearance_info = self.string()
                elif i2 == 9:
                    self.first_chapter_list.append(Chapter.decode(self))
                elif i2 == 10:
                    self.last_chapter_list.append(Chapter.decode(self))
                elif i2 == 11:
                    self.decode_banner()
                elif i2 == 12:
                    self.recommended_title_list.append(Title.decode(self))
                elif i2 == 13:
                    self.decode_sns()
                elif i2 == 14:
                    self.is_simul_released = self.bool()
                elif i2 == 15:
                    self.is_subscribed = self.bool()
                elif i2 == 16:
                    self.rating = self.uint32()
                elif i2 == 17:
                    self.chapters_descending = self.bool()
                elif i2 == 18:
                    self.number_of_views = self.uint32()
                else:
                    self.skip_type(7 & i2_)

        # Reset pos after decoding
        self.pos = 0

    def decode_banner(self):
        t = self.uint32()
        n = len(self.data) if t == 0 else self.pos + t
        while self.pos < n:
            i_ = self.uint32()
            i = i_ >> 3

            if i == 1:
                # banner url
                self.string()
            elif i == 2:
                self.decode_transition_action()
            elif i == 3:
                # banner id
                self.uint32()
            else:
                self.skip_type(7 & i_)

    def decode_transition_action(self):
        # Needed to keep position in sync. The function itself doesn't return anything
        # but it will change object state
        t = self.uint32()
        n = len(self.data) if t == 0 else self.pos + t
        while self.pos < n:
            i_ = self.uint32()
            i = i_ >> 3

            if i == 1:
                self.uint32()
            elif i == 2:
                self.string()
            else:
                self.skip_type(7 & i_)

    def decode_sns(self):
        t = self.uint32()
        n = len(self.data) if t == 0 else self.pos + t
        while self.pos < n:
            i_ = self.uint32()
            i = i_ >> 3

            if i == 1:
                self.string()
            elif i == 2:
                self.string()
            else:
                self.skip_type(7 & i_)


class MangaPlus(BaseScraper):
    API = 'https://jumpg-webapi.tokyo-cdn.com/api/title_detail?title_id={}'
    URL = 'https://mangaplus.shueisha.co.jp'
    CHAPTER_REGEX = re.compile(r'#(\d+)')

    @staticmethod
    def parse_chapter(chapter_number):
        match = MangaPlus.CHAPTER_REGEX.match(chapter_number)
        if not match:
            raise ValueError('Invalid chapter number given')

        return int(match.groups()[0])

    def scrape_service(self, *args, **kwargs):
        pass

    def scrape_series(self, title_id, service_id, manga_id):
        try:
            r = requests.get(self.API.format(title_id))
        except requests.RequestException:
            logger.exception('Failed to fetch series')
            return False

        if r.status_code != 200:
            return False

        series = Series(r.content)
        try:
            series.decode()
        except ValueError:
            logger.exception('Failed to decode series')
            return False

        sql = 'INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_decimal, chapter_identifier, release_date, "group") ' \
              'VALUES (%s, %s, %s, %s, %s, %s, to_timestamp(%s), \'Shueisha\') ON CONFLICT DO NOTHING '

        base_values = (manga_id, service_id)
        chapters = [*series.first_chapter_list, *series.last_chapter_list]
        data = []
        for chapter in chapters:
            chapter_number = self.parse_chapter(chapter.name)
            data.append([*base_values, chapter.sub_title, chapter_number, None, chapter.chapter_id, chapter.start_timestamp])

        now = datetime.utcnow()
        if series.next_timestamp:
            next_update = series.next_timestamp
        else:
            next_update = int((now + timedelta(days=1)).timestamp())

        with self.conn.cursor() as cursor:
            execute_batch(cursor, sql, data)

            sql = 'UPDATE manga_service SET last_check=%s, next_update=to_timestamp(%s) WHERE manga_id=%s AND service_id=%s'
            cursor.execute(sql, [now, next_update, manga_id, service_id])

            sql = 'UPDATE services SET last_check=%s WHERE service_id=%s'
            cursor.execute(sql, [now, service_id])

        self.conn.commit()
        return True
