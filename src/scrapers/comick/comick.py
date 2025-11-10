import logging
import re
from collections.abc import Collection, Iterable
from datetime import datetime, timedelta
from json.decoder import JSONDecodeError
from typing import cast, override

from psycopg import Connection
from psycopg.rows import DictRow

from src.constants import NO_GROUP
from src.db.models.groups import GroupPartial
from src.scrapers.base_scraper import (
    BaseChapterSimple,
    BaseScraperWhole,
    ScrapeServiceRetVal,
)
from src.utils.dbutils import DbUtil

from .comick_api import ChapterResult, ChapterResultWithManga, ComickAPI

logger = logging.getLogger('debug')


class Chapter(BaseChapterSimple):
    def __init__(
        self,
        *,
        chapter_hid: str,
        chapter_number: str | None,
        volume: str | None,
        manga_hid: str,
        created_at: datetime,
        published_at: datetime | None,
        chapter_title: str | None,
        group: list[str] | None = None,
        manga_title: str | None = None,
        group_id: int | None = None,
    ):
        if not chapter_number:
            _chapter_number = 0
            _decimal = None

        elif match := re.match(r'(\d+)([A-z])', chapter_number):
            _chapter_number = int(match.group(1))
            _decimal = ord(match.group(2).lower()) - ord('a') + 1
            if not chapter_title:
                chapter_title = f'Chapter {chapter_number}'
        else:
            try:
                # Split chapter number to decimal part and integer part
                n = list(map(int, chapter_number.split('.')))
            except ValueError:
                if chapter_number.lower() not in ('prologue', 'special'):
                    logger.warning(
                        f'Failed to parse chapter number {chapter_number} for {manga_hid}'
                    )
                _chapter_number = 0
                _decimal = None
            else:
                _chapter_number = n[0]
                _decimal = None if len(n) == 1 else n[1]

        try:
            _volume = int(volume) if volume is not None else None
            # Sometimes weird volumes exist
        except ValueError:
            _volume = None

        super().__init__(
            chapter_title=chapter_title or None,
            chapter_number=_chapter_number,
            decimal=_decimal,
            chapter_identifier=chapter_hid,
            title_id=manga_hid,
            volume=_volume,
            release_date=published_at or created_at,
            manga_title=manga_title,
            group=group[0] if group and len(group) > 0 else None,
            group_id=group_id,
        )

    @override
    @property
    def title(self) -> str:
        return (
            self.chapter_title
            or f'{"Volume " + str(self.volume) + ", " if self.volume is not None else ""}Chapter {self.chapter_number}{"" if not self.decimal else "." + str(self.decimal)}'
        )


class Comick(BaseScraperWhole):
    ID = 10
    URL = 'https://comick.io'
    NAME = 'Comick'
    FEED_URL = 'https://api.comick.fun'
    UPDATE_INTERVAL = timedelta(minutes=45)
    CHAPTER_URL_FORMAT = 'https://comick.io/comic/{title_id}/{}'
    MANGA_URL_FORMAT = 'https://comick.io/comic/{}'

    def __init__(self, conn: Connection[DictRow], dbutil: DbUtil | None = None):
        super().__init__(conn, dbutil)

        self.api = ComickAPI()

    @staticmethod
    def parse_feed(
        entries: Iterable[ChapterResult] | Iterable[ChapterResultWithManga],
        title_id: str | None
    ) -> list[Chapter]:
        chapters = []
        for chapter in entries:
            try:
                # Mypy thinks attrs is of type DataT which makes no sense as DataT is a TypeVar
                chapters.append(
                    Chapter(
                        chapter_hid=chapter.hid,
                        chapter_number=chapter.chap,
                        volume=chapter.vol,
                        manga_hid=chapter.md_comics.hid if isinstance(chapter, ChapterResultWithManga) else cast(str, title_id),
                        created_at=chapter.created_at,
                        published_at=chapter.publish_at,
                        chapter_title=chapter.title,
                        group=chapter.group_name,
                        manga_title=chapter.md_comics.title if isinstance(chapter, ChapterResultWithManga) else None,
                        group_id=None,  # Will be set later
                    )
                )
            except Exception:
                logger.exception(f'Failed to parse chapter {chapter}')
                continue

        return chapters

    def get_group_ids_by_names(self, group_names: Collection[str]) -> dict[str, int]:
        if len(group_names) == 0:
            return {}

        format_args = self.dbutil.get_format_args(group_names)
        sql = f'SELECT name, group_id FROM groups WHERE name IN ({format_args})'
        result: dict[str, int] = {}
        for row in self.dbutil.execute(sql, group_names, fetch=True):
            result[row['name']] = row['group_id']

        return result

    def map_and_add_group_ids(self, entries: list[Chapter]) -> list[Chapter]:
        """
        Maps the correct group ids to the given chapters
        """
        valid_chapters: list[Chapter] = []
        existing: dict[str, int] = {}
        no_group: list[Chapter] = []

        # Add group id to chapters and add them to valid_chapters
        def map_chapters(chapters: list[Chapter]) -> list[Chapter]:
            not_found: list[Chapter] = []
            for c in reversed(chapters):
                if c.group is None:
                    no_group.append(c)
                    continue

                if c.group not in existing:
                    not_found.append(c)
                    continue

                c.group_id = existing[c.group]
                valid_chapters.append(c)

            return not_found

        # Find existing groups by comick id and add them
        group_names: set[str] = {c.group for c in entries if c.group is not None}
        existing = self.get_group_ids_by_names(group_names)
        missing_group = map_chapters(entries)

        # Add new groups if they exist
        if missing_group:
            for group in self.dbutil.add_new_groups([
                GroupPartial(name=c.group)
                for c in missing_group
            ]):
                existing[group.name] = group.group_id

            missing_group = map_chapters(missing_group)

        # If no groups were found use No group
        if missing_group:
            logger.error(
                'Failed to add group to some chapters. Using "No group". %s', missing_group
            )
            for chapter in missing_group:
                chapter.group_id = NO_GROUP
                valid_chapters.append(chapter)

        # Set group id to NO_GROUP for chapters that do not have a group
        for c in no_group:
            c.group_id = NO_GROUP
            valid_chapters.append(c)

        return valid_chapters

    def fetch_chapters(
        self, api_url: str, title_id: str | None = None, limit: int = 100
    ) -> list[Chapter] | None:
        self.api.base_url = api_url
        try:
            if title_id is None:
                result = self.api.get_chapters(languages=['en'])
            else:
                result = self.api.get_manga_chapters(title_id, languages=['en'], limit=limit)
            return list(self.parse_feed(result, title_id))
        except JSONDecodeError:
            logger.exception('Failed to parse comick response')
            return None
        except ValueError as e:
            logger.exception(f'Failed to parse comick result {e}')
            return None

    def do_update(
        self, service_id: int, feed_url: str, title_id: str | None = None, limit: int = 100
    ) -> ScrapeServiceRetVal | None:
        """
        Handles fetching the chapter feed and adding the results to the database
        and other required operations
        """
        parsed = self.fetch_chapters(feed_url, title_id=title_id, limit=limit)
        if parsed is None:
            return None

        if not parsed:
            return ScrapeServiceRetVal()

        new_entries = self.get_new_entries(service_id, parsed)
        if not new_entries:
            return ScrapeServiceRetVal()

        # Update chapter titles for old chapters when scraping a series
        # This is because fetching title chapters also gives us the titles of chapters
        if title_id is not None:
            old_chapters = set(parsed) - set(new_entries)
            self.dbutil.update_chapter_titles(service_id, old_chapters)

        # Add group ids to chapters
        new_entries = self.map_and_add_group_ids(list(new_entries))

        titles = self.group_by_manga(new_entries)

        manga_ids: set[int] = set()
        chapters = self.map_already_added_titles(service_id, titles, manga_ids)

        # Fetch manga title and other info and discard manga that were not found
        # manga title set to temp as it will be replaced later
        mangas = self.titles_dict_to_manga_service(titles, service_id, True, manga_title='temp')
        manga_titles = {e.title_id: cast(str, e.manga_title) for e in new_entries}
        # Fetch for all manga as this information is used later on
        for m in mangas:
            m.title = manga_titles[m.title_id]

        # Add new manga
        self.add_new_manga_with_dupe_check(
            service_id,
            mangas,
            manga_ids,
            chapters,
            titles
        )

        inserted = self.dbutil.add_chapters(chapters, fetch=True)
        self.update_latest_chapter(chapters)

        chapter_ids = {c.chapter_id for c in inserted}
        return ScrapeServiceRetVal(manga_ids=manga_ids, chapter_ids=chapter_ids)

    @override
    def scrape_series(
        self, title_id: str, service_id: int, manga_id: int, feed_url: str | None
    ) -> set[int] | None:
        if feed_url is None:
            raise ValueError('feed_url cannot be None')

        retval = self.do_update(service_id, feed_url, title_id, limit=150)
        return retval if retval is None else retval.chapter_ids

    @override
    def scrape_service(
        self,
        service_id: int,
        feed_url: str,
        last_update: datetime | None,
    ) -> ScrapeServiceRetVal | None:
        return self.do_update(service_id, feed_url)
