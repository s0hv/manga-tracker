import abc
import logging
import re
from abc import ABC
from datetime import datetime
from typing import Optional, Set, cast, List, Type, TypeVar, Dict, Tuple

from lxml import etree

from src.scrapers.base_scraper import BaseChapterSimple, ScrapeServiceRetVal, \
    BaseScraperWhole

logger = logging.getLogger('debug')

chapter_regex = re.compile(r'^Chapter (?P<chapter_number>\d+)((-\d+)| ?(?P<special_chapter>ex\d*|\w|extra *\d*))?(\.(?P<chapter_decimal>\d+))?( – (?P<chapter_title>.+?))?$', re.I)


class ParsedChapter(BaseChapterSimple, ABC):
    invalid: bool

    @abc.abstractmethod
    def __init__(self, chapter_element: etree.ElementBase, group_id: Optional[int] = None): ...

    def __repr__(self) -> str:
        return f'{self.manga_title} chapter {self.chapter_number}: {self.title}'

    @property
    def chapter_title(self) -> str:
        # Guaranteed string in this class
        return cast(str, self._chapter_title)

    @property
    def title(self) -> str:
        return self.chapter_title

    def parse_title(self, title: str) -> Optional[Tuple[str, int, Optional[int]]]:
        match = chapter_regex.match(title)
        if not match:
            logger.error(f'Failed to parse title from {title}')
            self.invalid = True
            return None

        d = match.groupdict()
        chapter_number = int(d['chapter_number'])
        special_chapter = d['special_chapter']
        chapter_decimal: Optional[int] = None
        if d['chapter_decimal']:
            chapter_decimal = int(d['chapter_decimal'])

        if special_chapter and chapter_decimal is not None:
            logger.warning(f'Special chapter and chapter decimal specified for azuki chapter {title}')

        if chapter_decimal is None and special_chapter:
            if len(special_chapter) == 1:
                chapter_decimal = ord(special_chapter.lower()) - ord('a') + 1
            else:
                chapter_decimal = 5

        chapter_title = d['chapter_title'] or title

        return chapter_title, chapter_number, chapter_decimal


TChapter = TypeVar('TChapter', bound=ParsedChapter)


class MangaChapter(ParsedChapter):
    def __init__(self, chapter_element: etree.ElementBase, group_id: Optional[int] = None):
        self.invalid = False

        title_el = chapter_element.cssselect('a.a-card-link')[0]

        title_id = title_el.attrib['href'].split('/')[2]
        if not title_id:
            logger.error(f'Title id not parsed correctly from {title_el.attrib["href"]}')
            self.invalid = True
            return

        chapter_identifier = title_el.attrib['href'].split('/')[-1]

        time_elements = chapter_element.cssselect('time')
        if not time_elements:
            release_date = datetime.today()
        else:
            time_el = time_elements[0]
            release_date = datetime.fromisoformat(time_el.attrib['datetime'].replace('Z', '+00:00')).replace(tzinfo=None)

        title_full = title_el.cssselect('span span')[0].text.strip()
        result = self.parse_title(title_full)
        if result is None:
            return

        chapter_title, chapter_number, chapter_decimal = result

        BaseChapterSimple.__init__(
            self,
            chapter_title=chapter_title,
            chapter_number=chapter_number,
            chapter_identifier=chapter_identifier,
            title_id=title_id,
            volume=None,
            decimal=chapter_decimal,
            release_date=release_date,
            manga_title=None,
            manga_url=None,
            group=Azuki.NAME,
            group_id=group_id,
        )

    @property
    def manga_title(self) -> Optional[str]:
        return self._manga_title

    @manga_title.setter
    def manga_title(self, val: str):
        self._manga_title = val


class ReleaseChapter(ParsedChapter):
    def __init__(self, chapter_element: etree.ElementBase, group_id: Optional[int] = None):
        self.invalid = False
        title_el, chapter_el, date_el = chapter_element.cssselect('td')

        manga_title = title_el.cssselect('cite')[0].text.strip()
        title_id = title_el.cssselect('a')[0].attrib['href'].split('/')[-1]

        chapter_link = chapter_el.cssselect('a')[0]
        title = chapter_link.text.strip()
        chapter_identifier = chapter_link.attrib['href'].split('/')[-1]

        result = self.parse_title(title)
        if result is None:
            return

        chapter_title, chapter_number, chapter_decimal = result

        try:
            release_date = datetime.strptime(date_el.text.strip(), '%b %d, %Y')
        except ValueError:
            logger.exception('Failed to parse time')
            self.invalid = True
            return

        BaseChapterSimple.__init__(
            self,
            chapter_title=chapter_title,
            chapter_number=chapter_number,
            chapter_identifier=chapter_identifier,
            title_id=title_id,
            volume=None,
            decimal=chapter_decimal,
            release_date=release_date,
            manga_title=manga_title,
            manga_url=None,
            group=Azuki.NAME,
            group_id=group_id,
        )


class Azuki(BaseScraperWhole):
    ID = 9
    URL = 'https://www.azuki.co'
    FEED_URL = 'https://www.azuki.co/release-calendar'
    NAME = 'Azuki'
    CHAPTER_URL_FORMAT = 'https://www.azuki.co/series/{title_id}/read/{}'
    MANGA_URL_FORMAT = 'https://www.azuki.co/series/{}'

    @staticmethod
    def parse_chapters(rows: List[etree.ElementBase], chapter_cls: Type[TChapter], group_id: int) -> List[TChapter]:
        chapters = []
        now = datetime.today()
        for row in rows:
            c: TChapter = chapter_cls(row, group_id=group_id)
            if c.invalid or c.release_date > now:
                continue

            chapters.append(c)

        return chapters

    def get_manga_chapters(self, title_id: str, group_id: int) -> Optional[List[MangaChapter]]:
        r = self.fetch_url(self.MANGA_URL_FORMAT.format(title_id))
        if r is None:
            return None

        root = etree.HTML(r.text)

        chapter_rows = root.xpath(".//azuki-chapter-row-list//li[contains(@class, 'm-chapter-row') and not(contains(@class, 'm-chapter-row--upcoming'))]")
        chapters = self.parse_chapters(chapter_rows, MangaChapter, group_id)

        try:
            manga_title = root.cssselect('div.o-series-summary h1')[0].text.strip()
        except:
            logger.exception('Failed to extract title from manga page')
        else:
            for c in chapters:
                c.manga_title = manga_title

        return chapters

    def scrape_series(self, title_id: str, service_id: int, manga_id: Optional[int],
                      feed_url: str = None) -> Optional[Set[int]]:
        group_id = self.dbutil.get_or_create_group(self.NAME).group_id
        chapters = self.get_manga_chapters(title_id, group_id)

        if chapters is None:
            return None

        all_chapters = set(chapters)
        new_chapters = self.dbutil.get_only_latest_entries(service_id, chapters)
        old_chapters = all_chapters - set(new_chapters)

        self.dbutil.update_chapter_titles(service_id, old_chapters)
        retval = self.handle_adding_chapters(new_chapters, service_id)

        return set() if not retval else retval.chapter_ids

    def scrape_service(self, service_id: int, feed_url: str,
                       last_update: Optional[datetime],
                       title_id: Optional[str] = None) -> Optional[ScrapeServiceRetVal]:
        r = self.fetch_url(feed_url)
        if r is None:
            return None

        root = etree.HTML(r.text)
        chapter_rows = root.cssselect('table tbody tr')

        group_id = self.dbutil.get_or_create_group(self.NAME).group_id
        chapters = self.parse_chapters(chapter_rows, ReleaseChapter, group_id)

        chapters = list(self.dbutil.get_only_latest_entries(service_id, chapters))
        if not chapters:
            return ScrapeServiceRetVal(
                manga_ids=set(),
                chapter_ids=set()
            )

        logger.debug(f'{len(chapters)} new chapters on {self.NAME}')

        grouped = self.group_by_manga(chapters)

        if len(grouped) <= 3:
            for key, manga_chapters in grouped.items():
                logger.debug(f'Fetching chapter titles for {key}')
                named_chapters = self.get_manga_chapters(key, group_id)
                if not named_chapters:
                    continue

                mapped: Dict[str, ParsedChapter] = {c.chapter_identifier: c for c in manga_chapters}

                for c in named_chapters:
                    temp = mapped.get(c.chapter_identifier)
                    if not temp:
                        continue

                    temp._chapter_title = c.chapter_title

        return self.handle_adding_chapters(chapters, service_id)
