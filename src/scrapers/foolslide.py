import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime, date, timedelta
from typing import Optional, Set, List, Pattern

import pytz
import requests
from lxml import etree

from src.scrapers.base_scraper import BaseScraperWhole, BaseChapter

logger = logging.getLogger('debug')


class FoolSlideChapter(BaseChapter):
    """
    FoolSlide chapter
    """

    chapter_number_regex: Pattern = re.compile(r'.+?/(?P<volume>\d+)/(?P<chapter>\d+)/?(?P<decimal>\d+)?/?$')

    def __init__(self,
                 chapter_element: etree.ElementBase,
                 manga_title: str,
                 title_id: str
                 ):
        chapter_link = chapter_element.find('div/a')
        chapter_url = chapter_link.attrib['href']
        self._chapter_title = chapter_link.text

        if (m := self.chapter_number_regex.match(chapter_url)) is None:
            raise ValueError('FoolSlide regex failed to find chapter numbers')

        match = m.groupdict()
        volume = match['volume']
        decimal = match['decimal']
        self._chapter_number = int(match['chapter'])
        self._volume = int(volume) if volume != '0' else None
        self._decimal = int(decimal) if decimal else None

        self._chapter_identifier = title_id + chapter_url.split(f'{title_id}')[1].rstrip('/')

        self._group = chapter_element.cssselect('.meta_r a')[0].text

        release_text = chapter_element.cssselect('.meta_r a')[0].tail.strip(', \n').lower()
        if release_text == 'today':
            self._release_date = datetime.combine(date.today(), datetime.min.time())
        elif release_text == 'yesterday':
            self._release_date = datetime.combine(date.today() - timedelta(hours=24), datetime.min.time())
        else:
            self._release_date = datetime.strptime(release_text, '%Y.%m.%d')

        self._release_date.replace(tzinfo=pytz.utc)

        self._title_id = title_id
        self._manga_title = manga_title

    @property
    def chapter_title(self) -> Optional[str]:
        return self._chapter_title

    @property
    def chapter_number(self) -> int:
        return self._chapter_number

    @property
    def volume(self) -> Optional[int]:
        return self._volume

    @property
    def decimal(self) -> Optional[int]:
        return self._decimal

    @property
    def release_date(self) -> datetime:
        return self._release_date

    @property
    def chapter_identifier(self) -> str:
        return self._chapter_identifier

    @property
    def title_id(self) -> str:
        return self._title_id

    @property
    def manga_title(self) -> Optional[str]:
        return self._manga_title

    @property
    def manga_url(self) -> Optional[str]:
        return None

    @property
    def group(self) -> Optional[str]:
        return self._group

    @property
    def title(self) -> str:
        return self.chapter_title or f'{"Volume " + str(self.volume) + ", " if self.volume is not None else ""}Chapter {self.chapter_number}{"" if not self.decimal else "." + str(self.decimal)}'


class FoolSlide(BaseScraperWhole, ABC):
    @staticmethod
    @abstractmethod
    def min_update_interval() -> timedelta:
        raise NotImplementedError

    @staticmethod
    def get_title_id(url: str) -> str:
        return url.split('/series/', 1)[1].strip('/')

    @staticmethod
    def parse_feed(html: str, manga_page: bool = False) -> List[FoolSlideChapter]:
        root: etree.ElementBase = etree.HTML(html)
        titles: List[etree.ElementBase]
        if manga_page:
            titles = root.cssselect('div.group > div.title')
        else:
            titles = root.cssselect('div.group > div.title')

        chapters = []

        for title in titles:
            link = title.find('a')
            title_id = FoolSlide.get_title_id(link.attrib['href'])
            manga_title = link.text.strip()
            for chapter_elem in title.getparent().cssselect('div.element'):
                chapters.append(
                    FoolSlideChapter(
                        chapter_elem,
                        manga_title=manga_title,
                        title_id=title_id
                    )
                )

        return chapters

    def scrape_series(self, title_id: str, service_id: int, manga_id: Optional[int], feed_url: Optional[str] = None) -> Optional[bool]:
        r = requests.get(self.MANGA_URL_FORMAT.format(title_id))
        if not r.ok:
            logger.error(f'Failed to fetch {type(self).__name__} {feed_url}')
            return None

        # Series specific parsing can be done in a more simple manner
        root: etree.ElementBase = etree.HTML(r.text)
        chapters = []

        for chapter_elem in root.cssselect('div.list div.element'):
            chapters.append(
                FoolSlideChapter(
                    chapter_elem,
                    manga_title=root.cssselect('h1.title')[0].text.strip(),
                    title_id=title_id
                )
            )

        retval = self.handle_adding_chapters(chapters, service_id)
        return retval if retval is None else bool(retval)

    def scrape_service(self, service_id: int, feed_url: str, last_update: Optional[datetime],
                       title_id: Optional[str] = None) -> Optional[Set[int]]:
        r = requests.get(feed_url)
        if not r.ok:
            logger.error(f'Failed to fetch {type(self).__name__} {feed_url}')
            return None

        return self.handle_adding_chapters(self.parse_feed(r.text), service_id)
