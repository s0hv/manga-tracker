import logging
import re
import time
import typing
from calendar import timegm
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Any

import feedparser
from lxml import etree

from src.errors import FeedHttpError, InvalidFeedError, RequiredInformationMissing
from src.scrapers.base_scraper import BaseScraper, BaseChapter
from src.utils.utilities import match_title, is_valid_feed, get_latest_chapters

logger = logging.getLogger('debug')


class Chapter(BaseChapter):
    def __init__(self, chapter: Optional[str], chapter_identifier: str, title_id: str,
                 manga_url: str, chapter_title: Optional[str] = None,
                 release_date: Optional[time.struct_time] = None, volume: Optional[int] = None,
                 decimal: Optional[int] = None, group: Optional[str] = None, **_):
        self._chapter_title = chapter_title or None
        self._chapter_number = int(chapter) if chapter else 0
        self._volume = int(volume) if volume is not None else None
        self._decimal = int(decimal) if decimal else None
        self._release_date = datetime.utcfromtimestamp(timegm(release_date)) if release_date else datetime.utcnow()
        self._chapter_identifier = chapter_identifier
        self._title_id = title_id
        self._manga_url = manga_url
        self._group = group

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
    def manga_title(self) -> str:
        return ''

    @property
    def manga_url(self) -> str:
        return self._manga_url

    @property
    def group(self) -> Optional[str]:
        return self._group

    @property
    def title(self) -> str:
        return self.chapter_title or f'Chapter {self.chapter_number}{"" if not self.decimal else "." + str(self.decimal)}'


class Reddit(BaseScraper):
    ID = 6
    URL = 'https://www.reddit.com'
    NAME = 'Reddit'
    CHAPTER_REGEX = re.compile(r'(?:.+?)?chapter (?P<chapter>\d+)(?: \(?part (?P<decimal>\d+)\)?)?(?P<language> \[.+?])?(?: translated)?', re.I)
    SUBREDDIT_REGEX = re.compile(r'https?://(?:www\.)?reddit.com/(r/\w+).*')
    UPDATE_INTERVAL = timedelta(minutes=30)
    CHAPTER_URL_FORMAT = '{}'
    MANGA_URL_FORMAT = 'https://www.reddit.com/r/{}'

    @staticmethod
    def min_update_interval() -> timedelta:
        return Reddit.UPDATE_INTERVAL

    @staticmethod
    def parse_feed(entries: typing.Iterable[dict]) -> List[Chapter]:
        chapters = []
        for post in entries:
            title = post.get('title', '')
            m = Reddit.CHAPTER_REGEX.match(title)
            kwargs: Dict[str, Any]
            if not m:
                m = match_title(title)
                if not m:
                    logger.warning(f'Could not parse title from {title or post}')
                    continue

                logger.warning(f'Fallback to universal regex successful on {title or post}')

                kwargs = m
            else:
                kwargs = m.groupdict()

            if not kwargs['chapter']:
                logger.error(f'Failed to get chapter number from title "{title}"')
                continue

            kwargs['chapter_title'] = title

            # The tree might have more than one root element so force it to have only a single one
            tree = etree.fromstring(f"<root>{post.get('summary', '')}</root>")
            kwargs['chapter_identifier'] = tree.cssselect('span a')[0].get('href')
            if not kwargs['chapter_identifier']:
                logger.error(f'Chapter identifier not found from {post}')
                continue

            kwargs['title_id'] = post['link'].split('/r/')[-1].split('/')[0]
            kwargs['manga_url'] = Reddit.MANGA_URL_FORMAT.format(kwargs['title_id'])

            if not kwargs['title_id'] or not kwargs['chapter_identifier']:
                logger.warning(f'Could not parse ids from {post}')
                continue

            kwargs['release_date'] = post.get('published_parsed') or post.get('updated_parsed')

            if group := Reddit.SUBREDDIT_REGEX.match(post['link']):
                kwargs['group'] = group.groups()[0]
            else:
                kwargs['group'] = 'reddit'

            chapters.append(Chapter(**kwargs))

        return chapters

    def scrape_series(self, title_id: str, service_id: int, manga_id: int, feed_url: Optional[str] = None) -> Optional[bool]:
        if not feed_url:
            raise RequiredInformationMissing('Feed url is missing when it is required')

        feed = feedparser.parse(feed_url)
        try:
            is_valid_feed(feed)
        except (FeedHttpError, InvalidFeedError):
            logger.exception(f'Failed to fetch feed {feed_url}')
            return

        self.dbutil.set_manga_last_checked(service_id, manga_id, datetime.utcnow())
        self.dbutil.update_manga_next_update(service_id, manga_id, self.next_update())

        chapters = self.dbutil.get_only_latest_entries(service_id, self.parse_feed(feed.entries))
        if not chapters:
            logger.debug(f'Nothing to update in {feed_url}')
            return False

        logger.info(f'{len(chapters)} new chapters on {feed_url}')
        self.dbutil.add_chapters(manga_id, service_id, chapters, fetch=False)

        chapter_rows = [{
            'chapter_decimal': c.decimal,
            'manga_id': manga_id,
            'chapter_number': c.chapter_number,
            'release_date': c.release_date
        } for c in chapters]
        self.dbutil.update_latest_chapter(tuple(c for c in get_latest_chapters(chapter_rows).values()))
        return True

    def scrape_service(self, service_id: int, feed_url: str, last_update: Optional[datetime], title_id: Optional[str] = None):
        return None
