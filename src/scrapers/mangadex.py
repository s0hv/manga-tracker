import logging
import re
import time
import typing
from calendar import timegm
from datetime import datetime, timedelta
from itertools import groupby
from json.decoder import JSONDecodeError
from typing import Dict, Collection, Iterable, Optional, List, Any

import feedparser
import psycopg2
import requests
from psycopg2.extras import execute_values

from src.errors import FeedHttpError, InvalidFeedError
from src.scrapers.base_scraper import BaseScraper, BaseChapter
from src.utils.utilities import match_title, is_valid_feed, get_latest_chapters

logger = logging.getLogger('debug')


class Chapter(BaseChapter):
    def __init__(self, chapter: Optional[str], chapter_identifier: str, manga_id: str,
                 manga_title: str, manga_url: str, chapter_title: Optional[str] = None,
                 release_date: Optional[time.struct_time] = None, volume: Optional[int] = None,
                 decimal: Optional[int] = None, group: Optional[str] = None, **_):
        self._chapter_title = chapter_title or None
        self._chapter_number = int(chapter) if chapter else 0
        self._volume = int(volume) if volume is not None else None
        self._decimal = int(decimal) if decimal else None
        self._release_date = datetime.utcfromtimestamp(timegm(release_date)) if release_date else datetime.utcnow()
        self._chapter_identifier = chapter_identifier
        self._manga_id = manga_id
        self._manga_title = manga_title
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
        return self._manga_id

    @property
    def manga_title(self) -> str:
        return self._manga_title

    @property
    def manga_url(self) -> str:
        return self._manga_url

    @property
    def group(self) -> Optional[str]:
        return self._group

    @property
    def title(self) -> str:
        return self.chapter_title or f'{"Volume " + str(self.volume) + ", " if self.volume is not None else ""}Chapter {self.chapter_number}{"" if not self.decimal else "." + str(self.decimal)}'


class MangaDex(BaseScraper):
    ID = 2
    URL = 'https://mangadex.org'
    NAME = 'MangaDex'
    FEED_URL = 'REPLACE ME'  # Temp url that will be replaced in the database
    CHAPTER_REGEX = re.compile(r'(?P<manga_title>.+) -($| (((?:Volume (?P<volume>\d+),? )?Chapter (?P<chapter>\d+)(?:\.?(?P<decimal>\d+))?)|(?:(?P<chapter_title>.+?)(( - )?Oneshot)?)$))')
    DESCRIPTION_REGEX = re.compile(r'Group: (?P<group>.+?) - Uploader: (?P<uploader>.+?) - Language: (?P<language>\w+)')
    UPDATE_INTERVAL = timedelta(minutes=30)
    MANGADEX_API = 'https://mangadex.org/api'
    CHAPTER_URL_FORMAT = 'https://mangadex.org/chapter/{}'
    MANGA_URL_FORMAT = 'https://mangadex.org/title/{}'

    @staticmethod
    def min_update_interval() -> timedelta:
        return MangaDex.UPDATE_INTERVAL

    def scrape_series(self, title_id, feed_url=None):
        pass

    def set_checked(self, service_id: int) -> None:
        try:
            super().set_checked(service_id)
            self.dbutil.update_service_whole(service_id, self.min_update_interval())
        except psycopg2.Error:
            logger.exception(f'Failed to update service {service_id}')

    def get_only_latest_entries(self, service_id: int, entries: Iterable[Chapter]) -> Collection[Chapter]:
        try:
            sql = 'SELECT chapter_identifier FROM chapters WHERE service_id=%s ORDER BY chapter_id DESC LIMIT 400'
            with self.conn as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, (service_id,))
                    chapters = set(r[0] for r in cur)

            return set(entries).difference(chapters)

        except:
            logger.exception('Failed to get old chapters')
            return list(entries)

    @staticmethod
    def parse_feed(entries: typing.Iterable[dict]) -> List[Chapter]:
        titles = []
        for post in entries:
            title = post.get('title', '')
            m = MangaDex.CHAPTER_REGEX.match(title)
            kwargs: Dict[str, Any]
            if not m:
                m = match_title(title)
                if not m:
                    logger.warning(f'Could not parse title from {title or post}')
                    continue

                logger.debug(f'Fallback to universal regex successful on {title or post}')

                kwargs = m
            else:
                kwargs = m.groupdict()

            kwargs['chapter_identifier'] = post.get('link', '').split('/')[-1]
            manga_id = post.get('mangalink', '').split('/')[-1]
            kwargs['manga_id'] = manga_id

            if not kwargs['manga_id'] or not kwargs['chapter_identifier']:
                logger.warning(f'Could not parse ids from {post}')
                continue

            kwargs['manga_url'] = post.get('mangalink', '')
            kwargs['release_date'] = post.get('published_parsed')
            match = MangaDex.DESCRIPTION_REGEX.match(post.get('description', ''))
            if match:
                kwargs.update(match.groupdict())

            titles.append(Chapter(**kwargs))

        return titles

    def scrape_service(self, service_id: int, feed_url: str, last_update: Optional[datetime], title_id: Optional[str] = None):
        feed = feedparser.parse(feed_url if not title_id else feed_url + f'/manga_id/{title_id}')
        try:
            is_valid_feed(feed)
        except (FeedHttpError, InvalidFeedError):
            logger.exception(f'Failed to fetch feed {feed_url}')
            return

        entries = self.get_only_latest_entries(service_id, self.parse_feed(feed.entries))

        if not entries:
            logger.info('No new entries found')
            return

        logger.info('%s new chapters found. %s', len(entries), [e.chapter_identifier for e in entries])

        titles: Dict[str, List[Chapter]] = {}
        # Must be sorted for groupby to work, as it only splits the list each time the key changes
        for k, g in groupby(sorted(entries, key=Chapter.title_id.fget), Chapter.title_id.fget):  # type: ignore
            titles[k] = list(g)  # type: ignore[index]

        data = []
        manga_ids = set()
        mangadex_ids = {}
        with self.conn:
            with self.conn.cursor() as cur:
                for row in self.dbutil.find_added_titles(cur, tuple(titles.keys())):
                    manga_id = row['manga_id']
                    manga_ids.add(manga_id)
                    mangadex_ids[manga_id] = row['title_id']
                    for chapter in titles.pop(row['title_id']):
                        data.append((manga_id, service_id, chapter.title, chapter.chapter_number,
                                     chapter.decimal, chapter.chapter_identifier,
                                     chapter.release_date, chapter.group))

        if titles:
            with self.conn:
                with self.conn.cursor() as cur:
                    for manga_id, chapters in self.dbutil.add_new_series(cur, titles, service_id, True):
                        manga_ids.add(manga_id)
                        if chapters:
                            mangadex_ids[manga_id] = chapters[0].title_id
                        for chapter in chapters:
                            data.append((manga_id, service_id, chapter.title, chapter.chapter_number,
                                        chapter.decimal, chapter.chapter_identifier,
                                         chapter.release_date, chapter.group))

        sql = 'INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_decimal, chapter_identifier, release_date, "group") VALUES ' \
              '%s ON CONFLICT DO NOTHING RETURNING manga_id, chapter_number, chapter_decimal, release_date, chapter_identifier'

        with self.conn:
            with self.conn.cursor() as cur:
                rows = execute_values(cur, sql, data, page_size=len(data), fetch=True)
                manga_ids = {r['manga_id'] for r in rows}
                if manga_ids:
                    self.dbutil.update_latest_chapter(cur, tuple(c for c in get_latest_chapters(rows).values()))
                    self.update_chapter_infos([mangadex_ids[i] for i in mangadex_ids], [c['chapter_identifier'] for c in rows])

        return manga_ids

    def update_chapter_infos(self, title_ids: Iterable[str], chapter_ids: Iterable[str]):
        if not title_ids:
            return

        url = self.MANGADEX_API + '/manga/{}'
        headers = {}
        fails = 0
        sleep = 0.1
        chapters = []

        for idx, title_id in enumerate(title_ids):
            try:
                r = requests.get(url.format(title_id), headers=headers)
            except requests.RequestException:
                logger.exception('Failed to fetch manga data from mangadex api')
                return

            if 'set-cookie' in r.headers:
                cookies = r.headers['set-cookie']
                headers['cookies'] = cookies

            try:
                data = r.json()
            except JSONDecodeError:
                logger.error(f'Failed to json decode {str(r.content)}')
                fails += 1
                if fails > 2:
                    return
                continue

            if data.get('status') != 'OK':
                fails += 1
                if fails > 2:
                    return
                continue

            # TODO add manga info updates here

            for chapter_id in data.get('chapter', {}):
                if chapter_id not in chapter_ids:
                    continue

                chapter = data['chapter'][chapter_id]
                title = chapter.get('title')
                if not title:
                    continue

                chapters.append((
                    title,
                    chapter_id
                ))

            if idx % 10 == 0:
                time.sleep(1)
                sleep += 0.2
            else:
                time.sleep(sleep)

        if not chapters:
            return

        sql = 'UPDATE chapters SET title=c.title ' \
              'FROM (VALUES %s) as c(title, chapter_identifier) ' \
              'WHERE c.chapter_identifier=chapters.chapter_identifier'

        with self.conn:
            with self.conn.cursor() as cur:
                execute_values(cur, sql, chapters, page_size=500)

    def add_service(self):
        self.add_service_whole()
        logger.error('Mangadex feed url must be changed in the service_whole table before use')
