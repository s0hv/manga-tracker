import logging
import time
from abc import ABC, abstractmethod
from calendar import timegm
from datetime import datetime, timedelta
from typing import Optional, List, Iterable, Dict, Pattern, Any, Type, Union, \
    Set

import feedparser

from src.errors import FeedHttpError, InvalidFeedError
from src.scrapers.base_scraper import BaseScraperWhole, \
    BaseChapterSimple, ScrapeServiceRetVal
from src.utils.utilities import (match_title, is_valid_feed, utcnow,
                                 utcfromtimestamp)

logger = logging.getLogger('debug')


class RSSChapter(BaseChapterSimple):
    """
    A sensible default implementation for a chapter in an RSS feed
    """
    def __init__(self,
                 chapter_title: Optional[str],
                 chapter_number: str,
                 chapter_identifier: str,
                 title_id: str,
                 group_id: int,
                 volume: Optional[str] = None,
                 decimal: Optional[str] = None,
                 release_date: Optional[Union[time.struct_time, datetime]] = None,
                 manga_title: Optional[str] = None,
                 manga_url: Optional[str] = None,
                 group: Optional[str] = None,
                 # Ignore unused properties
                 **_
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
            group_id=group_id
        )

        if isinstance(release_date, time.struct_time):
            self._release_date = utcfromtimestamp(timegm(release_date))
        else:
            self._release_date = release_date if release_date else utcnow()

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
        return self._manga_url

    @property
    def group(self) -> Optional[str]:
        return self._group

    @property
    def title(self) -> str:
        return self.chapter_title or f'{"Volume " + str(self.volume) + ", " if self.volume is not None else ""}Chapter {self.chapter_number}{"" if not self.decimal else "." + str(self.decimal)}'


class BaseRSS(BaseScraperWhole, ABC):
    TITLE_REGEX: Pattern = NotImplemented
    Chapter: Type[RSSChapter] = RSSChapter

    def __init_subclass__(cls, **kwargs):
        if cls.TITLE_REGEX is None:
            raise NotImplementedError('Service does not have a title regex to parse entries')

        super(BaseRSS, cls).__init_subclass__()

    @abstractmethod
    def get_chapter_id(self, entry: Dict) -> str:
        """
        A method to get the chapter id for a feed entry
        Args:
            entry: A single entry in the RSS feed

        Returns:
            The id of the chapter
        """
        raise NotImplementedError()

    @abstractmethod
    def get_chapter_title(self, entry: Dict) -> Optional[str]:
        """
        Return the title of the chapter or None if the chapter name should be automatically generated
        Args:
            entry: A single entry in the RSS feed

        Returns:
            Title of the chapter or None
        """
        raise NotImplementedError()

    @abstractmethod
    def get_title_id(self, entry: Dict) -> str:
        """
        Get the title id for the manga of an entry
        Args:
            entry: A single entry in the RSS feed

        Returns:
            The title id
        """
        raise NotImplementedError()

    @abstractmethod
    def get_group(self, entry: Dict) -> Optional[str]:
        """
        Return the group responsible for this chapter
        Args:
            entry: A single entry in the RSS feed

        Returns:
            Name of the group
        """
        raise NotImplementedError

    @abstractmethod
    def get_manga_title(self, entry: Dict) -> Optional[str]:
        """
        Get the title of the manga. If None is returned use manga_title key from regex.
        Args:
            entry: A single entry in the RSS feed

        Returns:
            Title of the manga
        """
        raise NotImplementedError

    def skip_entry(self, entry: Dict) -> bool:
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

    def parse_feed(self, entries: Iterable[Dict], group_id: int) -> List[RSSChapter]:
        titles = []
        for entry in entries:
            if self.skip_entry(entry):
                continue

            title = entry.get('title', '')
            match = self.TITLE_REGEX.match(title)
            kwargs: Dict[str, Any]
            if not match:
                universal_match = match_title(title)
                if not universal_match:
                    logger.warning(f'Could not parse title from {title or entry}')
                    continue

                logger.info(f'Fallback to universal regex successful on {title or entry}')

                kwargs = universal_match
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

            if self.MANGA_URL_FORMAT is None or self.MANGA_URL_FORMAT == NotImplemented:
                kwargs['manga_url'] = None
            else:
                kwargs['manga_url'] = self.MANGA_URL_FORMAT.format(kwargs['title_id'])
            kwargs['release_date'] = entry.get('published_parsed') or entry.get('updated_parsed')
            kwargs['group'] = self.get_group(entry)
            kwargs['group_id'] = group_id

            try:
                titles.append(self.Chapter(**kwargs))
            except:
                logger.exception(f'Failed to parse chapter {entry}')
                continue

        return titles

    def min_update_interval(self) -> timedelta:
        return self.UPDATE_INTERVAL

    def scrape_series(self, title_id: str, service_id: int, manga_id: int,
                      feed_url: Optional[str] = None) -> Optional[Set[int]]:
        pass

    def get_feed_chapters(self, feed_url):
        feed = feedparser.parse(feed_url)
        try:
            is_valid_feed(feed)
        except (FeedHttpError, InvalidFeedError):
            logger.exception(f'Failed to fetch feed {feed_url}')
            return

        return self.parse_feed(feed.entries, self.get_group_id())

    def add_from_feed_url(self, service_id: int, feed_url: str) -> Optional[ScrapeServiceRetVal]:
        entries = self.get_feed_chapters(feed_url)
        if entries is None:
            return None

        return self.handle_adding_chapters(entries, service_id)

    def scrape_service(self, service_id: int, feed_url: str,
                       last_update: Optional[datetime],
                       title_id: Optional[str] = None):
        return self.add_from_feed_url(service_id, feed_url)
