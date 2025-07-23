import logging
import re
from datetime import datetime, timezone
from typing import cast, override

from lxml import etree

from src.scrapers.base_scraper import (
    BaseChapterSimple,
    BaseScraper,
    ScrapeServiceRetVal,
)

logger = logging.getLogger('debug')

chapter_regex = re.compile(
    r'^.+?\s-\s*'
    r'Chapter (?P<chapter_number>\d+)'
    r'(\.(?P<chapter_decimal>\d+))?'
    r'((:)? (?P<chapter_title>.+?))?$',
    re.I,
)


def get_group_name(elem: etree._Element) -> str:
    # Group name is the third column in the table
    group_name = elem.cssselect('td')[2].text
    if group_name is None:
        raise ValueError('Group name not found in chapter element')
    return group_name.strip()


class ParsedChapter(BaseChapterSimple):
    invalid: bool

    def __init__(
        self, chapter_element: etree._Element, group_id: int, manga_title: str | None = None
    ):
        self.invalid = False

        group_name = get_group_name(chapter_element)

        title_el = chapter_element.cssselect('td.chapter-title a')[0]

        # This value will be in the format gist/OPM/208/1/
        chapter_url = title_el.attrib['href'].removeprefix('/read/')

        # Title id is the first two parts of the URL, e.g., gist/OPM
        title_id = '/'.join(chapter_url.split('/')[:2])
        if not title_id:
            logger.error(f'Title id not parsed correctly from {title_el.attrib["href"]}')
            self.invalid = True
            return

        # Chapter identifier is the third part of the URL, e.g., 208
        chapter_identifier = chapter_url.split('/')[2]

        # Returns the date as a text like "[2025, 5, 19, 7, 48, 26]"
        time_element_list = chapter_element.cssselect('td.detailed-chapter-upload-date')
        time_element = time_element_list[0] if time_element_list else None
        if time_element is None:
            logger.exception('Failed to find time element in chapter row')
            self.invalid = True
            return

        time_text_elements = (time_element.text or '').strip().split(',')
        # Months are 0 indexed meaning january is 0
        month = int(time_text_elements[1]) + 1
        time_text_elements[1] = str(month)
        time_text = ', '.join(time_text_elements)
        release_date = datetime.strptime(time_text, '[%Y, %m, %d, %H, %M, %S]').replace(
            tzinfo=timezone.utc
        )

        # Parse chapter number from the data-chapter attribute
        chapter_number_str = chapter_element.attrib.get('data-chapter')
        if not chapter_number_str:
            logger.error('Chapter number not found from attribute data-chapter')
            self.invalid = True
            return

        # Parse the chapter number and decimal if present
        chapter_number_split = chapter_number_str.split('.')
        chapter_number = int(chapter_number_split[0])
        chapter_decimal: int | None = None

        if len(chapter_number_split) > 1:
            chapter_decimal = int(chapter_number_split[1])

        # Parse the chapter title from the text of the title element
        title_full = (title_el.text or '').strip()
        chapter_title = self.parse_title(title_full)
        if chapter_title is None:
            return

        super().__init__(
            chapter_title=chapter_title,
            chapter_number=chapter_number,
            chapter_identifier=chapter_identifier,
            title_id=title_id,
            volume=None,
            decimal=chapter_decimal,
            release_date=release_date,
            manga_title=manga_title,
            manga_url=None,
            group=group_name,
            group_id=group_id,
        )

    @override
    def __repr__(self) -> str:
        return f'{self.manga_title} chapter {self.chapter_number}: {self.title}'

    @override
    @property
    def chapter_title(self) -> str:
        # Guaranteed string in this class
        return cast(str, self._chapter_title)

    def parse_title(self, title: str) -> str | None:
        title_stripped = title.replace('\n', ' ').strip()
        match = chapter_regex.match(title_stripped)

        if not match:
            logger.error(f'Failed to parse title from {title_stripped}')
            self.invalid = True
            return None

        d = match.groupdict()

        # The title property handles the fallback for chapter title
        return d['chapter_title'] or ''


class Cubari(BaseScraper):
    ID = 11
    URL = 'https://cubari.moe'
    NAME = 'Cubari'
    CHAPTER_URL_FORMAT = 'https://cubari.moe/read/{title_id}/{}'
    MANGA_URL_FORMAT = 'https://cubari.moe/read/{}'

    def parse_chapters(
        self, rows: list[etree._Element], manga_title: str | None = None
    ) -> list[ParsedChapter]:
        chapters = []
        group_name_to_id: dict[str, int] = {}

        def get_group_id(name: str) -> int:
            if name not in group_name_to_id:
                group = self.dbutil.get_or_create_group(name)
                group_name_to_id[name] = group.group_id
            return group_name_to_id[name]

        for row in rows:
            group_name = get_group_name(row)
            c = ParsedChapter(
                row, group_id=get_group_id(group_name),
                manga_title=manga_title
            )
            if c.invalid:
                continue

            chapters.append(c)

        return chapters

    def get_manga_chapters(self, title_id: str) -> list[ParsedChapter] | None:
        r = self.fetch_url(self.MANGA_URL_FORMAT.format(title_id))
        if r is None:
            return None

        root = etree.HTML(r.text)
        manga_title: str | None = None

        try:
            manga_title = root.cssselect('div.series-content h1')[0].text.strip()  # type: ignore[union-attr]
        except Exception:
            logger.exception('Failed to extract title from manga page')

        chapter_rows = root.cssselect('table#chapters tbody tr')
        chapters = self.parse_chapters(chapter_rows, manga_title)

        return chapters

    @override
    def scrape_series(
        self, title_id: str, service_id: int, manga_id: int | None, feed_url: str | None = None
    ) -> set[int] | None:
        chapters = self.get_manga_chapters(title_id)

        if chapters is None:
            return None

        all_chapters = set(chapters)
        new_chapters = self.dbutil.get_only_latest_entries(service_id, chapters)
        old_chapters = all_chapters - set(new_chapters)

        self.dbutil.update_chapter_titles(service_id, old_chapters)
        retval = self.handle_adding_chapters(new_chapters, service_id)

        return set() if not retval else retval.chapter_ids

    @override
    def scrape_service(
        self,
        service_id: int,
        feed_url: str,
        last_update: datetime | None,
        title_id: str | None = None,
    ) -> ScrapeServiceRetVal | None:
        raise NotImplementedError(f'{self.NAME} does not support scraping the whole service')
