import logging
import re
from datetime import datetime, timezone
from typing import Self, cast, override

from lxml import etree

from src.db.models.chapter import ChapterFailed, ChapterFailedBase, ChapterFailedUnprocessable
from src.scrapers.base_scraper import (
    BaseChapterSimple,
    BaseScraper,
    ScrapeServiceRetVal,
)

logger = logging.getLogger(__name__)

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

    @classmethod
    def of_element(cls, chapter_element: etree._Element, group_id: int, manga_title: str | None = None) -> Self | ChapterFailedBase:
        group_name = get_group_name(chapter_element)

        title_el = chapter_element.cssselect('td.chapter-title a')[0]
        title_full = (title_el.text or '').strip()

        # This value will be in the format gist/OPM/208/1/
        chapter_url = title_el.attrib['href'].removeprefix('/read/')

        # Title id is the first two parts of the URL, e.g., gist/OPM
        title_id = '/'.join(chapter_url.split('/')[:2])
        if not title_id:
            return ChapterFailedUnprocessable(
                service_id=Cubari.ID,
                errors=f'Title id not parsed correctly from {title_el.attrib["href"]}',
                title=title_full,
                manga_title=manga_title,
            )

        # Chapter identifier is the third part of the URL, e.g., 208
        chapter_identifier = chapter_url.split('/')[2]

        # Returns the date as a text like "[2025, 5, 19, 7, 48, 26]"
        time_element_list = chapter_element.cssselect('td.detailed-chapter-upload-date')
        time_element = time_element_list[0] if time_element_list else None

        if time_element is None:
            return ChapterFailed(
                chapter_identifier=chapter_identifier,
                service_id=Cubari.ID,
                errors='Failed to find time element in chapter row',
                title=title_full,
                title_id=title_id,
                manga_title=manga_title,
                group=group_name,
            )

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
            return ChapterFailed(
                chapter_identifier=chapter_identifier,
                service_id=Cubari.ID,
                errors='Chapter number not found from attribute data-chapter',
                title=title_full,
                title_id=title_id,
                manga_title=manga_title,
                release_date=release_date,
                group=group_name,
            )

        # Parse the chapter number and decimal if present
        chapter_number_split = chapter_number_str.split('.')
        chapter_number = int(chapter_number_split[0])
        chapter_decimal: int | None = None

        if len(chapter_number_split) > 1:
            chapter_decimal = int(chapter_number_split[1])

        # Parse the chapter title from the text of the title element
        chapter_title = ParsedChapter.parse_title(title_full)
        if chapter_title is None:
            return ChapterFailed(
                chapter_identifier=chapter_identifier,
                service_id=Cubari.ID,
                errors=f'Failed to parse chapter title from {title_full}',
                title=title_full,
                title_id=title_id,
                manga_title=manga_title,
                release_date=release_date,
                group=group_name,
                chapter_number=chapter_number,
                chapter_decimal=chapter_decimal
            )

        return cls(
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
        return f'{self.manga_title or ''} chapter {self.chapter_number}: {self.title}'

    @override
    @property
    def chapter_title(self) -> str:
        # Guaranteed string in this class
        return cast(str, self._chapter_title)

    @staticmethod
    def parse_title(title: str) -> str | None:
        title_stripped = title.replace('\n', ' ').strip()
        match = chapter_regex.match(title_stripped)

        if not match:
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
    LOGGER = logger

    def parse_chapters(
        self, rows: list[etree._Element], manga_title: str | None = None
    ) -> tuple[list[ParsedChapter], list[ChapterFailedBase]]:
        chapters: list[ParsedChapter] = []
        chapters_failed: list[ChapterFailedBase] = []
        group_name_to_id: dict[str, int] = {}

        def get_group_id(name: str) -> int:
            if name not in group_name_to_id:
                group = self.dbutil.get_or_create_group(name)
                group_name_to_id[name] = group.group_id
            return group_name_to_id[name]

        for row in rows:
            group_name = get_group_name(row)
            c = ParsedChapter.of_element(
                row, group_id=get_group_id(group_name),
                manga_title=manga_title
            )
            if isinstance(c, ChapterFailedBase):
                chapters_failed.append(c)
                continue

            chapters.append(c)

        return chapters, chapters_failed

    def get_manga_chapters(self, title_id: str) -> tuple[list[ParsedChapter], list[ChapterFailedBase]] | None:
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

        return self.parse_chapters(chapter_rows, manga_title)

    @override
    def scrape_series(
        self, title_id: str, service_id: int, manga_id: int, feed_url: str | None = None
    ) -> set[int] | None:
        result = self.get_manga_chapters(title_id)

        if result is None:
            return None

        chapters, failed_chapters = result
        self.handle_failed_chapters(failed_chapters)

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
    ) -> ScrapeServiceRetVal | None:
        raise NotImplementedError(f'{self.NAME} does not support scraping the whole service')
