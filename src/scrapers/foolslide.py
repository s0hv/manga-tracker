import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime, date, timedelta
from typing import Optional, Set, List, Pattern

import pytz
import requests
from lxml import etree

from src.scrapers.base_scraper import BaseScraperWhole, BaseChapterSimple

logger = logging.getLogger('debug')


class FoolSlideChapter(BaseChapterSimple):
    """
    FoolSlide chapter
    """

    chapter_number_regex: Pattern = re.compile(r'.+?/(?P<volume>\d+)/(?P<chapter>\d+)/?(?P<decimal>\d+)?/?$')

    def __init__(self,
                 chapter_element: etree.ElementBase,
                 manga_title: str,
                 title_id: str,
                 group_id: Optional[int] = None
                 ):
        chapter_link = chapter_element.find('div/a')
        chapter_url = chapter_link.attrib['href']
        chapter_title = chapter_link.text

        if (m := self.chapter_number_regex.match(chapter_url)) is None:
            raise ValueError('FoolSlide regex failed to find chapter numbers')

        match = m.groupdict()
        volume = match['volume']
        decimal = match['decimal']
        chapter_number = int(match['chapter'])
        volume = int(volume) if volume != '0' else None
        decimal = int(decimal) if decimal else None

        chapter_identifier = title_id + chapter_url.split(f'{title_id}')[1].rstrip('/')

        group = chapter_element.cssselect('.meta_r a')[0].text

        release_text = chapter_element.cssselect('.meta_r a')[0].tail.strip(', \n').lower()
        if release_text == 'today':
            release_date = datetime.combine(date.today(), datetime.min.time())
        elif release_text == 'yesterday':
            release_date = datetime.combine(date.today() - timedelta(hours=24), datetime.min.time())
        else:
            release_date = datetime.strptime(release_text, '%Y.%m.%d')

        release_date.replace(tzinfo=pytz.utc)

        super().__init__(
            chapter_title=chapter_title,
            chapter_number=chapter_number,
            chapter_identifier=chapter_identifier,
            title_id=title_id,
            volume=volume,
            decimal=decimal,
            release_date=release_date,
            manga_title=manga_title,
            group=group,
            group_id=group_id
        )

    @property
    def title(self) -> str:
        return self.chapter_title or f'{"Volume " + str(self.volume) + ", " if self.volume is not None else ""}Chapter {self.chapter_number}{"" if not self.decimal else "." + str(self.decimal)}'


class FoolSlide(BaseScraperWhole, ABC):
    # Required or the class wont be marked as abstract
    @abstractmethod
    def _(self):
        pass

    @staticmethod
    def get_title_id(url: str) -> str:
        return url.split('/series/', 1)[1].strip('/')

    @staticmethod
    def parse_feed(html: str, group_id: int) -> List[FoolSlideChapter]:
        root: etree.ElementBase = etree.HTML(html)
        titles: List[etree.ElementBase] = root.cssselect('div.group > div.title')

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
                        title_id=title_id,
                        group_id=group_id
                    )
                )

        return chapters

    def get_group_id(self) -> int:
        return self.dbutil.get_or_create_group(self.NAME).group_id

    def scrape_series(self, title_id: str, service_id: int, manga_id: Optional[int], feed_url: Optional[str] = None) -> Optional[bool]:
        r = requests.get(self.MANGA_URL_FORMAT.format(title_id))
        if not r.ok:
            logger.error(f'Failed to fetch {type(self).__name__} {feed_url}')
            return None

        group_id = self.get_group_id()

        # Series specific parsing can be done in a more simple manner
        root: etree.ElementBase = etree.HTML(r.text)
        chapters = []

        for chapter_elem in root.cssselect('div.list div.element'):
            chapters.append(
                FoolSlideChapter(
                    chapter_elem,
                    manga_title=root.cssselect('h1.title')[0].text.strip(),
                    title_id=title_id,
                    group_id=group_id
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

        return self.handle_adding_chapters(
            self.parse_feed(r.text, self.get_group_id()),
            service_id
        )
