import logging
import time
from abc import ABC, abstractmethod
from calendar import timegm
from collections.abc import Iterable
from datetime import datetime, timedelta
from re import Pattern
from typing import Any, cast, override

import feedparser

from src.errors import FeedHttpError, InvalidFeedError
from src.scrapers.base_scraper import (
    BaseChapterSimple,
    BaseScraperWhole,
    ScrapeServiceRetVal,
)
from src.utils.utilities import is_valid_feed, match_title, utcfromtimestamp, utcnow

logger = logging.getLogger(__name__)


class RSSChapter(BaseChapterSimple):
    """
    A sensible default implementation for a chapter in an RSS feed
    """

    def __init__(
        self,
        chapter_title: str | None,
        chapter_number: str,
        chapter_identifier: str,
        title_id: str,
        group_id: int,
        volume: str | None = None,
        decimal: str | None = None,
        release_date: time.struct_time | datetime | None = None,
        manga_title: str | None = None,
        manga_url: str | None = None,
        group: str | None = None,
        # Ignore unused properties
        **_,
    ):
        super().__init__(
            chapter_title=chapter_title,
            chapter_number=int(chapter_number),
            chapter_identifier=chapter_identifier,
            title_id=title_id,
            volume=int(volume) if volume else None,
            decimal=int(decimal) if decimal else None,
            manga_title=manga_title,
            manga_url=manga_url,
            group=group,
            group_id=group_id,
        )

        if isinstance(release_date, time.struct_time):
            self._release_date = utcfromtimestamp(timegm(release_date))
        else:
            self._release_date = release_date if release_date else utcnow()

    @override
    @property
    def chapter_title(self) -> str | None:
        return self._chapter_title

    @override
    @property
    def chapter_number(self) -> int:
        return self._chapter_number

    @override
    @property
    def volume(self) -> int | None:
        return self._volume

    @override
    @property
    def decimal(self) -> int | None:
        return self._decimal

    @override
    @property
    def release_date(self) -> datetime:
        return self._release_date

    @override
    @property
    def chapter_identifier(self) -> str:
        return self._chapter_identifier

    @override
    @property
    def title_id(self) -> str:
        return self._title_id

    @override
    @property
    def manga_title(self) -> str | None:
        return self._manga_title

    @override
    @property
    def manga_url(self) -> str | None:
        return self._manga_url

    @override
    @property
    def group(self) -> str | None:
        return self._group

    @override
    @property
    def title(self) -> str:
        return (
            self.chapter_title
            or f'{"Volume " + str(self.volume) + ", " if self.volume is not None else ""}Chapter {self.chapter_number}{"" if not self.decimal else "." + str(self.decimal)}'
        )


class BaseRSS(BaseScraperWhole, ABC):
    TITLE_REGEX: Pattern = NotImplemented
    Chapter: type[RSSChapter] = RSSChapter

    @override
    def __init_subclass__(cls, **kwargs: dict):
        if cls.TITLE_REGEX is None:
            raise NotImplementedError('Service does not have a title regex to parse entries')

        super().__init_subclass__()

    @abstractmethod
    def get_chapter_id(self, entry: dict) -> str:
        """
        A method to get the chapter id for a feed entry
        Args:
            entry: A single entry in the RSS feed

        Returns:
            The id of the chapter
        """
        raise NotImplementedError()

    @abstractmethod
    def get_chapter_title(self, entry: dict) -> str | None:
        """
        Return the title of the chapter or None if the chapter name should be automatically generated
        Args:
            entry: A single entry in the RSS feed

        Returns:
            Title of the chapter or None
        """
        raise NotImplementedError()

    @abstractmethod
    def get_title_id(self, entry: dict) -> str:
        """
        Get the title id for the manga of an entry
        Args:
            entry: A single entry in the RSS feed

        Returns:
            The title id
        """
        raise NotImplementedError()

    @abstractmethod
    def get_group(self, entry: dict) -> str | None:
        """
        Return the group responsible for this chapter
        Args:
            entry: A single entry in the RSS feed

        Returns:
            Name of the group
        """
        raise NotImplementedError

    @abstractmethod
    def get_manga_title(self, entry: dict) -> str | None:
        """
        Get the title of the manga. If None is returned use manga_title key from regex.
        Args:
            entry: A single entry in the RSS feed

        Returns:
            Title of the manga
        """
        raise NotImplementedError

    @abstractmethod
    def skip_entry(self, entry: dict) -> bool:
        """
        Whether to skip the given entry
        Args:
            entry: A single entry in the RSS feed

        Returns:
             Whether this entry will be skipped or not
        """
        return False

    def get_group_id(self) -> int:
        return self.dbutil.get_or_create_group(self.NAME).group_id

    def parse_feed(self, entries: Iterable[dict], group_id: int) -> list[RSSChapter]:
        titles = []
        for entry in entries:
            if self.skip_entry(entry):
                continue

            title = entry.get('title', '')
            match = self.TITLE_REGEX.match(title)
            kwargs: dict[str, Any]
            if not match:
                universal_match = match_title(title)
                if not universal_match:
                    logger.warning(f'Could not parse title from {title or entry}')
                    continue

                logger.info(f'Fallback to universal regex successful on {title or entry}')

                kwargs = cast(Any, universal_match)
            else:
                kwargs = match.groupdict()

            kwargs['chapter_identifier'] = self.get_chapter_id(entry)
            kwargs['title_id'] = self.get_title_id(entry)
            kwargs['manga_title'] = self.get_manga_title(entry) or kwargs.get('manga_title')

            if not kwargs['title_id'] or not kwargs['chapter_identifier']:
                logger.warning(f'Could not parse ids from {entry}')
                continue

            if 'chapter_title' not in kwargs:
                kwargs['chapter_title'] = self.get_chapter_title(entry)

            if self.MANGA_URL_FORMAT == NotImplemented:
                kwargs['manga_url'] = None
            else:
                kwargs['manga_url'] = self.MANGA_URL_FORMAT.format(kwargs['title_id'])
            kwargs['release_date'] = entry.get('published_parsed') or entry.get('updated_parsed')
            kwargs['group'] = self.get_group(entry)
            kwargs['group_id'] = group_id

            try:
                titles.append(self.Chapter(**kwargs))
            except Exception:
                logger.exception(f'Failed to parse chapter {entry}')
                continue

        return titles

    @override
    def min_update_interval(self) -> timedelta:
        return self.UPDATE_INTERVAL

    @override
    def scrape_series(
        self, title_id: str, service_id: int, manga_id: int, feed_url: str | None = None
    ) -> set[int] | None:
        pass

    def get_feed_chapters(self, feed_url: str) -> list[RSSChapter] | None:
        feed = feedparser.parse(feed_url)
        try:
            is_valid_feed(feed)
        except (FeedHttpError, InvalidFeedError):
            logger.exception(f'Failed to fetch feed {feed_url}')
            return None

        return self.parse_feed(feed.entries, self.get_group_id())

    def add_from_feed_url(self, service_id: int, feed_url: str) -> ScrapeServiceRetVal | None:
        entries = self.get_feed_chapters(feed_url)
        if entries is None:
            return None

        return self.handle_adding_chapters(entries, service_id) or ScrapeServiceRetVal()

    @override
    def scrape_service(
        self,
        service_id: int,
        feed_url: str,
        last_update: datetime | None,
    ) -> ScrapeServiceRetVal | None:
        return self.add_from_feed_url(service_id, feed_url)
