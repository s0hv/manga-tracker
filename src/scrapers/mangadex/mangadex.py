import logging
import re
from collections.abc import Iterable, Sequence
from datetime import datetime, timedelta
from json.decoder import JSONDecodeError
from typing import cast, override

from psycopg import Connection
from psycopg.rows import DictRow

from src.constants import NO_GROUP
from src.db.models.authors import AuthorPartial, MangaArtist, MangaAuthor
from src.db.models.groups import Group, GroupPartial
from src.db.models.manga import MangaInfo
from src.scrapers.base_scraper import (
    BaseChapterSimple,
    BaseScraperWhole,
    ScrapeServiceRetVal,
)
from src.utils.dbutils import DbUtil

from .mangadex_api import (
    AuthorAttributes,
    ChapterAttributes,
    ChapterResult,
    MangadexAPI,
    MangadexData,
    MangaResult,
    ScanlationGroupAttributes,
)

logger = logging.getLogger('debug')


class Chapter(BaseChapterSimple):
    def __init__(
        self,
        chapter_number: str | None,
        chapter_identifier: str,
        manga_id: str,
        release_date: datetime,
        chapter_title: str | None,
        volume: str | None = None,
        group: MangadexData[ScanlationGroupAttributes] | None = None,
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
                        f'Failed to parse chapter number {chapter_number} for {manga_id}'
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
            chapter_identifier=chapter_identifier,
            title_id=manga_id,
            volume=_volume,
            release_date=release_date,
            manga_title=manga_title,
            group=None,
            group_id=group_id,
        )
        self._mangadex_group = group

    @override
    @property
    def group(self) -> str | None:
        return self._mangadex_group.attributes.name if self._mangadex_group else None

    @property
    def mangadex_group(self) -> MangadexData[ScanlationGroupAttributes] | None:
        return self._mangadex_group

    @override
    @property
    def title(self) -> str:
        return (
            self.chapter_title
            or f'{"Volume " + str(self.volume) + ", " if self.volume is not None else ""}Chapter {self.chapter_number}{"" if not self.decimal else "." + str(self.decimal)}'
        )


class MangaDex(BaseScraperWhole):
    ID = 2
    URL = 'https://mangadex.org'
    NAME = 'MangaDex'
    FEED_URL = 'https://api.mangadex.org'
    UPDATE_INTERVAL = timedelta(minutes=15)
    CHAPTER_URL_FORMAT = 'https://mangadex.org/chapter/{}'
    MANGA_URL_FORMAT = 'https://mangadex.org/title/{}'
    COVER_FORMAT: str = 'https://uploads.mangadex.org/covers/{title_id}/{file_name}'

    def __init__(self, conn: Connection[DictRow], dbutil: DbUtil | None = None):
        super().__init__(conn, dbutil)

        self.api = MangadexAPI()

    @staticmethod
    def parse_feed(entries: Iterable[ChapterResult]) -> list[Chapter]:
        chapters = []
        for chapter in entries:
            try:
                # Mypy thinks attrs is of type DataT which makes no sense as DataT is a TypeVar
                attrs: ChapterAttributes = chapter.attributes
                chapters.append(
                    Chapter(
                        attrs.chapter,
                        chapter.id,
                        chapter.manga_id,
                        attrs.readable_at,
                        attrs.title,
                        attrs.volume,
                        chapter.group,
                    )
                )
            except Exception:
                logger.exception(f'Failed to parse chapter {chapter}')
                continue

        return chapters

    def update_manga_info_and_title(self, mangas: dict[int, MangaResult]) -> None:
        """
        Updates infos and titles for the given manga
        Args:
            mangas: Dict[manga id, mangadex result]
        """
        # Tuple of cover url, manga id
        manga_infos: list[MangaInfo] = []
        for manga_id, manga in mangas.items():
            links = manga.attributes.links
            cover: str | None = None
            if manga.cover:
                cover = self.COVER_FORMAT.format(
                    title_id=manga.id,
                    file_name=manga.cover.attributes.file_name
                )

            manga_infos.append(
                MangaInfo(
                    manga_id=manga_id,
                    cover=cover,
                    status=manga.attributes.status.to_int(),
                    **links.model_dump(),
                )
            )

        self.dbutil.update_manga_infos(manga_infos, update_last_check=False)
        self.dbutil.update_manga_titles([
            (manga_id, m.attributes.title) for manga_id, m in mangas.items()
        ])

    def add_authors(self, mangas: list[tuple[MangaResult, int]]) -> None:
        """
        Add manga authors and artists to the database
        Args:
            mangas: List of manga, manga id pairs
        """
        author_ids: set[str] = set()
        # Type set to optional but in practice it can't be None
        author_map: dict[str | None, int] = {}
        add_authors: dict[str | None, MangadexData[AuthorAttributes]] = {}

        manga_ids: set[int] = {t[1] for t in mangas}
        without_author = self.dbutil.get_manga_ids_without_author(manga_ids)
        without_artist = self.dbutil.get_manga_ids_without_artist(manga_ids)

        # Only process artists and authors for manga with none assigned
        for manga, manga_id in mangas:
            if manga.authors and manga_id in without_author:
                author_ids.update(a.id for a in manga.authors)
                add_authors.update({a.id: a for a in manga.authors})

            if manga.artists and manga_id in without_artist:
                author_ids.update(a.id for a in manga.artists)
                add_authors.update({a.id: a for a in manga.artists})

        # Remove existing authors from the add list
        for author in self.dbutil.find_existing_mangadex_authors(list(author_ids)):
            add_authors.pop(author.mangadex_id, None)
            author_map[author.mangadex_id] = author.author_id

        if add_authors:
            for author in self.dbutil.add_authors([
                AuthorPartial(name=a.attributes.name, mangadex_id=a.id)
                for a in add_authors.values()
            ]):
                author_map[author.mangadex_id] = author.author_id

        manga_author: list[MangaAuthor] = []
        manga_artist: list[MangaArtist] = []
        for manga, manga_id in mangas:
            if manga.authors and manga_id in without_author:
                for auth in manga.authors:
                    manga_author.append(MangaAuthor(
                        manga_id=manga_id,
                        author_id=author_map[auth.id]
                    ))

            if manga.artists and manga_id in without_artist:
                for artist in manga.artists:
                    manga_artist.append(MangaArtist(
                        manga_id=manga_id,
                        author_id=author_map[artist.id]
                    ))

        self.dbutil.add_manga_authors(manga_author)
        self.dbutil.add_manga_artists(manga_artist)

    def get_group_ids_by_mangadex_id(self, group_ids: Sequence[str]) -> dict[str, int]:
        if len(group_ids) == 0:
            return {}

        format_args = self.dbutil.get_format_args(group_ids)
        sql = f'SELECT mangadex_id::text, group_id FROM groups WHERE mangadex_id IN ({format_args})'
        result: dict[str, int] = {}
        for row in self.dbutil.execute(sql, group_ids, fetch=True):
            result[row['mangadex_id']] = row['group_id']

        return result

    def map_and_add_group_ids(self, entries: list[Chapter]) -> list[Chapter]:
        """
        Maps the correct group ids to the given chapters
        """
        valid_chapters: list[Chapter] = []
        existing: dict[str, int] = {}
        no_group = [e for e in entries if not e.mangadex_group]

        # Add group id to chapters and add them to valid_chapters
        def map_chapters(chapters: list[Chapter]) -> list[Chapter]:
            not_found: list[Chapter] = []
            for c in reversed(chapters):
                if not c.mangadex_group:
                    continue

                if c.mangadex_group.id not in existing:
                    not_found.append(c)
                    continue

                c.group_id = existing[c.mangadex_group.id]
                valid_chapters.append(c)

            return not_found

        # Find existing groups by mangadex id and add them
        group_ids: set[str] = {c.mangadex_group.id for c in entries if c.mangadex_group}
        existing = self.get_group_ids_by_mangadex_id(list(group_ids))
        missing_group = map_chapters(entries)

        # Find groups with duplicate name
        existing_not_mangadex = self.dbutil.find_existing_groups([
            c.group for c in missing_group if c.group
        ])

        # Set mangadex id for existing groups
        do_mangadex_id_update: dict[str | None, Group] = {}
        for group in existing_not_mangadex:
            if group.mangadex_id is not None:
                logger.warning(
                    f'Duplicate group name found {group.name} with different id {group.mangadex_id}. Will be treated as the same group'
                )

            do_mangadex_id_update[group.name] = group

        # Set mangadex id for existing groups and add group ids to chapters
        if do_mangadex_id_update:
            for chapter in missing_group:
                found_group = do_mangadex_id_update.get(chapter.group)
                if found_group is None or chapter.mangadex_group is None:
                    continue

                mangadex_id = chapter.mangadex_group.id
                existing[mangadex_id] = found_group.group_id
                found_group.mangadex_id = mangadex_id

            self.dbutil.update_group_mangadex_ids(do_mangadex_id_update.values())

            missing_group = map_chapters(missing_group)

        # Add new groups if they exist
        if missing_group:
            for group in self.dbutil.add_new_groups([
                GroupPartial(name=c.mangadex_group.attributes.name, mangadex_id=c.mangadex_group.id)
                for c in missing_group
                if c.mangadex_group
            ]):
                existing[cast(str, group.mangadex_id)] = group.group_id

            missing_group = map_chapters(missing_group)

        # If no groups were found use No group
        if missing_group:
            logger.error(
                'Failed to add group to some chapters. Using "No group". %s', missing_group
            )
            for chapter in missing_group:
                chapter.group_id = NO_GROUP
                valid_chapters.append(chapter)

        # Some chapters are uploaded as no group
        for chapter in no_group:
            chapter.group_id = NO_GROUP
            valid_chapters.append(chapter)

        return valid_chapters

    def fetch_chapters(
        self, api_url: str, title_id: str | None = None, limit: int = 100
    ) -> list[Chapter] | None:
        self.api.base_url = api_url
        try:
            result = self.api.get_chapters(
                {'readableAt': 'desc'}, manga_id=title_id, languages=['en'], limit=limit
            )
            return list(self.parse_feed(result))
        except JSONDecodeError:
            logger.exception('Failed to parse mangadex response')
            return None
        except ValueError as e:
            logger.exception(f'Failed to parse mangadex result {e}')
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

        entries = self.get_new_entries(service_id, parsed)
        if not entries:
            return ScrapeServiceRetVal()

        # Add group ids to chapters
        entries = self.map_and_add_group_ids(list(entries))

        titles = self.group_by_manga(entries)

        manga_ids: set[int] = set()
        chapters = self.map_already_added_titles(service_id, titles, manga_ids)

        # Fetch manga title and other info and discard manga that were not found
        # manga title set to temp as it will be replaced later
        mangas = self.titles_dict_to_manga_service(titles, service_id, True, manga_title='temp')
        # Fetch for all manga as this information is used later on
        manga_infos = self.fetch_manga_infos(list({e.title_id for e in entries}))
        idx = len(mangas)
        for m in reversed(mangas):
            idx -= 1
            if m.title_id not in manga_infos:
                mangas.pop(idx)
            else:
                m.title = manga_infos[m.title_id].attributes.title

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
        # Sometimes manga cannot be fetched and this array is empty.
        # For example with content ratings
        if not manga_ids:
            return ScrapeServiceRetVal(chapter_ids=chapter_ids)

        # Update titles and manga infos for new chapters
        try:
            format_args = self.dbutil.get_format_args(manga_ids)
            sql = f'SELECT manga_id, title_id FROM manga_service WHERE manga_id IN ({format_args})'
            mangadex2db = {
                row['title_id']: row['manga_id']
                for row in self.dbutil.execute(sql, list(manga_ids))
            }
            db2result: dict[int, MangaResult] = {}

            for mangadex_id, manga_result in manga_infos.items():
                db2result[mangadex2db[mangadex_id]] = manga_result

            self.update_manga_info_and_title(db2result)
            self.add_authors([(v, k) for k, v in db2result.items()])
        except Exception:
            logger.exception('Failed to add manga infos')

        return ScrapeServiceRetVal(manga_ids=manga_ids, chapter_ids=chapter_ids)

    @override
    def scrape_series(
        self, title_id: str, service_id: int, manga_id: int, feed_url: str | None
    ) -> set[int] | None:
        if feed_url is None:
            raise ValueError('feed_url cannot be None')

        retval = self.do_update(service_id, feed_url, title_id, limit=300)
        return retval if retval is None else retval.chapter_ids

    @override
    def scrape_service(
        self,
        service_id: int,
        feed_url: str,
        last_update: datetime | None,
        title_id: str | None = None,
    ) -> ScrapeServiceRetVal | None:
        return self.do_update(service_id, feed_url)

    def fetch_manga_infos(self, title_ids: list[str]) -> dict[str, MangaResult]:
        chunk = 100
        mangas: dict[str, MangaResult] = {}
        for i in range(0, len(title_ids), chunk):
            ids = title_ids[i:i+chunk]

            try:
                parsed = self.api.get_manga(ids)
            except Exception as e:
                logger.exception(f'Failed to fetch manga {e}')
                return mangas

            for manga in parsed:
                mangas[manga.id] = manga

        return mangas
