import logging
import re
import time
import typing
from calendar import timegm
from datetime import datetime, timedelta
from typing import Any, override

import feedparser
from lxml import etree

from src.errors import FeedHttpError, InvalidFeedError
from src.scrapers.base_scraper import BaseChapterSimple, BaseScraper
from src.utils.utilities import (
    get_latest_chapters,
    is_valid_feed,
    match_title,
    utcfromtimestamp,
    utcnow,
)

logger = logging.getLogger('debug')


class Chapter(BaseChapterSimple):
    def __init__(self, chapter_number: str | None, chapter_identifier: str, title_id: str,
                 manga_url: str, chapter_title: str | None = None,
                 release_date: time.struct_time | None = None, volume: int | None = None,
                 decimal: int | None = None, group: str | None = None,
                 group_id: int | None = None,
                 **_):
        super().__init__(
            chapter_title=chapter_title or None,
            chapter_number=int(chapter_number) if chapter_number else 0,
            decimal=int(decimal) if decimal else None,
            chapter_identifier=chapter_identifier,
            title_id=title_id,
            volume=int(volume) if volume is not None else None,
            release_date=utcfromtimestamp(timegm(release_date)) if release_date else utcnow(),
            group=group,
            manga_url=manga_url,
            group_id=group_id
        )

    @override
    @property
    def title(self) -> str:
        return self.chapter_title or f'Chapter {self.chapter_number}{"" if not self.decimal else "." + str(self.decimal)}'


class Reddit(BaseScraper):
    ID = 6
    URL = 'https://www.reddit.com'
    NAME = 'Reddit'
    CHAPTER_REGEX = re.compile(r'(?:.+?)?(chapter|update) (?P<chapter_number>\d+)(?: \(?part (?P<decimal>\d+)\)?)?(?P<language> \[.+?])?(?: translated)?', re.I)
    SUBREDDIT_REGEX = re.compile(r'https?://(?:www\.)?reddit.com/(r/\w+).*')
    UPDATE_INTERVAL = timedelta(minutes=30)
    CHAPTER_URL_FORMAT = '{}'
    MANGA_URL_FORMAT = 'https://www.reddit.com/r/{}'

    SPECIAL_REGEX = re.compile(r'volume \d+ (bonus)? chapter .+?', re.I)

    @staticmethod
    def parse_feed(entries: typing.Iterable[dict], group_id: int | None = None) -> list[Chapter]:
        chapters = []
        for post in entries:
            title = post.get('title', '')
            match = Reddit.CHAPTER_REGEX.match(title)
            kwargs: dict[str, Any]
            if not match:
                m = match_title(title)

                if not m:
                    # Special chapter titles that don't have enough information on them
                    # to set any properties
                    special = Reddit.SPECIAL_REGEX.match(title)
                    if not special:
                        logger.info(f'Could not parse title from {title or post}')
                        continue

                    # Special cases don't have a chapter number shown so default to 0
                    kwargs = {
                        'chapter_number': '0'
                    }

                else:
                    logger.info(f'Fallback to universal regex successful on {title or post}')

                    kwargs = m
            else:
                kwargs = match.groupdict()

            if not kwargs['chapter_number']:
                logger.error(f'Failed to get chapter number from title "{title}"')
                continue

            kwargs['chapter_title'] = title
            kwargs['group_id'] = group_id

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

    @override
    def scrape_series(self, title_id: str, service_id: int, manga_id: int, feed_url: str | None) -> set[int] | None:
        if feed_url is None:
            raise ValueError('feed_url cannot be None')

        feed = feedparser.parse(feed_url)
        try:
            is_valid_feed(feed)
        except (FeedHttpError, InvalidFeedError):
            logger.exception(f'Failed to fetch feed {feed_url}')
            return None

        self.dbutil.set_manga_last_checked(service_id, manga_id, utcnow())
        self.dbutil.update_manga_next_update(service_id, manga_id, self.next_update())

        group_name = '/'.join(feed_url.split('reddit.com/')[1].split('/')[:2])
        group_id = self.dbutil.get_or_create_group(group_name).group_id

        chapters = self.dbutil.get_only_latest_entries(service_id, self.parse_feed(feed.entries, group_id=group_id))
        if not chapters:
            logger.debug(f'Nothing to update in {feed_url}')
            return set()

        logger.info(f'{len(chapters)} new chapters on {feed_url}')
        inserted = self.dbutil.add_chapters(list(chapters), manga_id, service_id, fetch=True)

        chapter_rows = [{
            'chapter_decimal': c.decimal,
            'manga_id': manga_id,
            'chapter_number': c.chapter_number,
            'release_date': c.release_date
        } for c in chapters]
        self.dbutil.update_latest_chapter(tuple(c for c in get_latest_chapters(chapter_rows).values()))
        return {row.chapter_id for row in inserted}

    @override
    def scrape_service(self, service_id: int, feed_url: str, last_update: datetime | None, title_id: str | None = None) -> None:
        return None
