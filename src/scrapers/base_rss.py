import time
from abc import ABC, abstractmethod
from calendar import timegm
from datetime import datetime, timedelta
import feedparser
from typing import Optional, List, Iterable, Dict, Pattern, Any, Type, Union
import logging

import psycopg2

from src.db.mappers.chapter_mapper import ChapterMapper
from src.errors import FeedHttpError, InvalidFeedError
from src.scrapers.base_scraper import BaseScraper, BaseChapter
from src.utils.utilities import (match_title, is_valid_feed, group_by_manga,
                                 get_latest_chapters)

logger = logging.getLogger('debug')


class RSSChapter(BaseChapter):
    """
    A sensible default implementation for a chapter in an RSS feed
    """
    def __init__(self,
                 chapter_title: Optional[str],
                 chapter_number: str,
                 chapter_identifier: str,
                 title_id: str,
                 volume: str = None,
                 decimal: str = None,
                 release_date: Optional[Union[time.struct_time, datetime]] = None,
                 manga_title: str = None,
                 manga_url: str = None,
                 group: str = None
                 ):
        self._chapter_title = chapter_title
        self._chapter_number = int(chapter_number)
        self._chapter_identifier = chapter_identifier
        self._title_id = title_id
        self._volume = int(volume) if volume else None
        self._decimal = int(decimal) if decimal else None
        self._manga_title = manga_title
        self._manga_url = manga_url
        self._group = group

        if isinstance(release_date, time.struct_time):
            self._release_date = datetime.utcfromtimestamp(timegm(release_date))
        else:
            self._release_date = release_date if release_date else datetime.utcnow()

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


class BaseRSS(BaseScraper, ABC):
    TITLE_REGEX: Pattern = None
    Chapter: Type[RSSChapter] = RSSChapter

    def __init_subclass__(cls, **kwargs):
        if cls.TITLE_REGEX is None:
            raise NotImplementedError('Service does not have a title regex to parse entries')

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
        Get the title of the manga
        Args:
            entry: A single entry in the RSS feed

        Returns:
            Title of the manga
        """
        raise NotImplementedError

    def set_checked(self, service_id: int) -> None:
        try:
            super().set_checked(service_id)
            self.dbutil.update_service_whole(service_id, self.min_update_interval())
        except psycopg2.Error:
            logger.exception(f'Failed to update service {service_id}')

    def parse_feed(self, entries: Iterable[Dict]) -> List[RSSChapter]:
        titles = []
        for entry in entries:
            title = entry.get('title', '')
            match = self.TITLE_REGEX.match(title)
            kwargs: Dict[str, Any]
            if not match:
                match = match_title(title)
                if not match:
                    logger.warning(f'Could not parse title from {title or entry}')
                    continue

                logger.info(f'Fallback to universal regex successful on {title or entry}')

                kwargs = match
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

            kwargs['manga_url'] = self.MANGA_URL_FORMAT.format(kwargs['title_id'])
            kwargs['release_date'] = entry.get('published_parsed') or entry.get('updated_parsed')
            kwargs['group'] = self.get_group(entry)

            try:
                titles.append(self.Chapter(**kwargs))
            except:
                logger.exception(f'Failed to parse chapter {entry}')
                continue

        return titles

    @staticmethod
    def min_update_interval() -> timedelta:
        return BaseRSS.UPDATE_INTERVAL

    def scrape_series(self, title_id: str, service_id: int, manga_id: int,
                      feed_url: Optional[str] = None) -> Optional[bool]:
        pass

    def scrape_service(self, service_id: int, feed_url: str,
                       last_update: Optional[datetime],
                       title_id: Optional[str] = None):
        feed = feedparser.parse(feed_url if not title_id else feed_url + f'/manga_id/{title_id}')
        try:
            is_valid_feed(feed)
        except (FeedHttpError, InvalidFeedError):
            logger.exception(f'Failed to fetch feed {feed_url}')
            return

        entries: List[RSSChapter] = self.dbutil.get_only_latest_entries(service_id, self.parse_feed(feed.entries))

        if not entries:
            logger.info('No new entries found')
            return

        logger.info('%s new chapters found. %s', len(entries),
                    [e.chapter_identifier for e in entries])

        titles = group_by_manga(entries)

        chapters = []
        manga_ids = set()

        # Find already added titles
        with self.conn:
            with self.conn.cursor() as cur:
                for row in self.dbutil.find_added_titles(cur, tuple(titles.keys())):
                    manga_id = row['manga_id']
                    manga_ids.add(manga_id)
                    for chapter in titles.pop(row['title_id']):
                        chapters.append(ChapterMapper.base_chapter_to_db(chapter, manga_id, service_id))

        # Add new titles
        if titles:
            with self.conn:
                with self.conn.cursor() as cur:
                    for manga_id, inner_chapters in self.dbutil.add_new_series(cur, titles, service_id, True):
                        manga_ids.add(manga_id)
                        for chapter in inner_chapters:
                            chapters.append(ChapterMapper.base_chapter_to_db(chapter, manga_id, service_id))

        self.dbutil.add_chapters(chapters, fetch=False)

        chapter_rows = [{
            'chapter_decimal': c.chapter_decimal,
            'manga_id': c.manga_id,
            'chapter_number': c.chapter_number,
            'release_date': c.release_date
        } for c in chapters]
        self.dbutil.update_latest_chapter(tuple(c for c in get_latest_chapters(chapter_rows).values()))

        return manga_ids

    def add_service(self):
        self.add_service_whole()
