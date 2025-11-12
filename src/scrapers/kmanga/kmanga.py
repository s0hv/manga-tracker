import logging
import random
import re
import time
from datetime import datetime, timedelta
from typing import cast, override

from psycopg import Connection
from psycopg.rows import DictRow

from src.db.models.groups import Group
from src.db.models.manga import (
    MangaService,
    MangaServicePartialWithId,
    MangaServiceWithId,
)
from src.scrapers.base_scraper import (
    BaseChapterSimple,
    BaseScraperWhole,
    ScrapeServiceRetVal,
)
from src.utils.dbutils import DbUtil
from src.utils.utilities import utcnow

from .api import KMangaAPI, KMangaEpisode

logger = logging.getLogger(__name__)

chapter_regex = re.compile(
    r'^\s*#?final chapter\s*'
    r'(\((?P<chapter_decimal_final>\d+)\))?\s*'
    # This can sometimes be an empty string
    r'(?P<chapter_title_final>.*?)$'
    r'|'
    r'^\s*(chapter|#)\s*'
    r'(?P<chapter_number>\d+)\s*'
    r'(\((?P<chapter_decimal>\d+)\))?\s*'
    r'(?P<chapter_title>.+?)$'
    r'|'
    # Fallback for chapters like "Lesson10", "TRACK 2",
    # or chapters with special characters such as ＃ at the start.  # noqa: RUF003
    r'^\s*.+?\s*(?P<chapter_number2>\d+)\s*'
    r'(\((?P<chapter_decimal2>\d+)\))?\s*',
    re.I
)


class KMangaChapter(BaseChapterSimple):
    @staticmethod
    def of_kmanga_episode(
        episode: KMangaEpisode,
        group_id: int,
        *,
        prev_chapter_number: int,
        prev_chapter_decimal: int,
    ) -> 'KMangaChapter':
        match = chapter_regex.match(episode.episode_name)

        chapter_title: str
        chapter_number: int
        chapter_decimal: int | None = None

        if match:
            if (chapter_number2 := match.group('chapter_number2')) is not None:
                chapter_title = episode.episode_name
                chapter_number = int(chapter_number2)

                if (decimal := match.group('chapter_decimal2')) is not None:
                    chapter_decimal = int(decimal)

            elif (chapter_title_final := match.group('chapter_title_final')) is not None:
                chapter_title = chapter_title_final or episode.episode_name
                chapter_number = prev_chapter_number + 1

                if (decimal := match.group('chapter_decimal_final')) is not None:
                    chapter_decimal = int(decimal)

                    # Only add the decimal if it is not already in the title
                    if chapter_title_final:
                        chapter_title = f'{chapter_title} ({decimal})'

            else:
                chapter_title = match.group('chapter_title')
                chapter_number = int(match.group('chapter_number'))

                if (decimal := match.group('chapter_decimal')) is not None:
                    chapter_decimal = int(decimal)
                    chapter_title = f'{chapter_title} ({decimal})'


        else:
            # In this case we are most likely dealing with a special chapter.
            # The caller should handle the case of too many of these chapters in a row,
            # as that most likely indicates an error in the parser.
            chapter_number = prev_chapter_number
            chapter_decimal = 5
            chapter_title = episode.episode_name

        # If chapter numbers equal and the current decimal is smaller or None,
        # we have not parsed the decimal correctly. In this case just increment the previous decimal.
        if prev_chapter_number == chapter_number and (
            chapter_decimal is None or chapter_decimal <= prev_chapter_decimal
        ):
            # If the previous decimal is 0, we increment by 2.
            # This should handle cases where the decimal is missing from a sequence of chapters.
            # e.g., track 2 (1), track 2 (2), track 2 (3), ...
            if prev_chapter_decimal == 0:
                chapter_decimal = 2
            else:
                chapter_decimal = prev_chapter_decimal + 1

        return KMangaChapter(
            chapter_title=chapter_title,
            chapter_number=chapter_number,
            decimal=chapter_decimal,
            volume=episode.comic_volume,
            release_date=episode.start_time,
            title_id=str(episode.title_id),
            chapter_identifier=str(episode.episode_id),
            group_id=group_id,
        )


class KManga(BaseScraperWhole):
    ID = 12
    URL = 'https://kmanga.kodansha.com'
    NAME = 'KManga'
    CHAPTER_URL_FORMAT = 'https://kmanga.kodansha.com/title/{title_id}/episode/{}'
    MANGA_URL_FORMAT = 'https://kmanga.kodansha.com/title/{}'
    GROUP = 'Kodansha'
    # Not used anywhere, but shown to display the interval that should match the database
    UPDATE_INTERVAL = timedelta(hours=6)

    def __init__(self, conn: Connection[DictRow], dbutil: DbUtil | None = None):
        super().__init__(conn, dbutil)

        self.api = KMangaAPI()
        self._group: Group | None = None

    def get_group(self) -> Group:
        if self._group is None:
            self._group = self.dbutil.get_or_create_group(self.GROUP)

        return self._group

    def get_manga_chapters(self, title_id: str) -> list[KMangaChapter] | None:
        title_chapters_list = self.api.get_title_chapters(title_id)
        if title_chapters_list is None:
            return None

        for title_chapters in title_chapters_list:
            if title_chapters.status != 'success':
                logger.warning(
                    "non-success chapters response '%s' from KManga api with message: %s",
                    title_chapters.status,
                    title_chapters.error_message,
                )
                return None

        episodes = [
            episode
            for title_chapters in title_chapters_list
            for episode in title_chapters.episode_list
        ]

        group_id = self.get_group().group_id

        chapters = []

        def get_index(episode_: KMangaEpisode) -> int:
            return episode_.index

        prev_chapter_number = 0
        prev_chapter_decimal = 0

        for idx, episode in enumerate(sorted(episodes, key=get_index)):
            chapter = KMangaChapter.of_kmanga_episode(episode, group_id, prev_chapter_number=prev_chapter_number, prev_chapter_decimal=prev_chapter_decimal)
            chapters.append(chapter)

            prev_chapter_number = chapter.chapter_number
            prev_chapter_decimal = chapter.decimal or 0

            if prev_chapter_number == 0 and idx == 10:
                logger.warning(f'Too many special chapters in a row. Probably an error in KManga chapter parsing. Example chapter: {episode}')

        return chapters

    @override
    def scrape_series(
        self, title_id: str, service_id: int, manga_id: int, feed_url: str | None = None
    ) -> set[int] | None:
        chapters = self.get_manga_chapters(title_id)

        if chapters is None:
            return None

        retval = self.handle_adding_chapters(chapters, service_id, strip_chapter_prefix=True)

        # The scheduler normally does this, but only for non-disabled series
        self.dbutil.set_manga_last_checked(service_id, manga_id, utcnow())

        return set() if not retval else retval.chapter_ids

    @override
    def scrape_service(
        self,
        service_id: int,
        feed_url: str,
        last_update: datetime | None,
    ) -> ScrapeServiceRetVal | None:
        latest_updates = self.api.get_latest_updates(utcnow())

        if latest_updates.status != 'success':
            logger.warning(
                'non-success latest updates response %s from KManga api with message: %s',
                latest_updates.status,
                latest_updates.error_message,
            )
            return None

        title_ids = [str(title.title_id) for title in latest_updates.title_list]
        existing_titles = list(self.dbutil.find_added_titles(service_id, title_ids))
        existing_title_ids = {title.title_id for title in existing_titles}

        new_titles = self.dbutil.add_new_manga_and_check_duplicate_titles([
            MangaService(
                service_id=service_id,
                disabled=True,
                title_id=str(title_update.title_id),
                title=title_update.title_name,
                manga_id=None,
            )
            for title_update in latest_updates.title_list
            if str(title_update.title_id) not in existing_title_ids
        ])

        titles_to_update: list[MangaServicePartialWithId | MangaServiceWithId] = cast(
            list[MangaServicePartialWithId | MangaServiceWithId],
            new_titles
        )
        now = utcnow()

        for title in existing_titles:
            # Only update titles that have not been checked in a day
            if title.last_check is None or (title.last_check - now) > timedelta(days=1):
                titles_to_update.append(title)

        manga_ids = set()
        chapter_ids = set()

        for title in titles_to_update:
            manga_id = title.manga_id

            logger.info(
                'Scraping KManga series %s %s',
                title.title_id,
                hasattr(title, 'title') and title.title,
            )

            try:
                scrape_value = self.scrape_series(title.title_id, service_id, manga_id)
            except ValueError:
                logger.error('Failed to scrape series while scraping KManga service')
                continue

            if scrape_value is None:
                continue

            manga_ids.add(manga_id)
            chapter_ids.update(scrape_value)

            # Sleep for a random time after each scrape
            time.sleep(random.random() * 5)

        return ScrapeServiceRetVal(
            manga_ids=manga_ids,
            chapter_ids=chapter_ids,
        )
