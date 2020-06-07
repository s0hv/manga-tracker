import logging
import re
import time
from calendar import timegm
from datetime import datetime, timedelta
from json.decoder import JSONDecodeError

import feedparser
import psycopg2
import requests
from psycopg2.extras import execute_values

from src.errors import FeedHttpError, InvalidFeedError
from src.scrapers.base_scraper import BaseScraper, BaseChapter
from src.utils.feedparsing import get_latest_entries
from src.utils.utilities import match_title, is_valid_feed, get_latest_chapters

logger = logging.getLogger('debug')


class Chapter(BaseChapter):
    def __init__(self, chapter, chapter_identifier, manga_id, manga_title,
                 manga_url, chapter_title=None, release_date=None, volume=None,
                 decimal=None, group=None, **_):
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
    def chapter_title(self):
        return self._chapter_title

    @property
    def chapter_number(self):
        return self._chapter_number

    @property
    def volume(self):
        return self._volume

    @property
    def decimal(self):
        return self._decimal

    @property
    def release_date(self):
        return self._release_date

    @property
    def chapter_identifier(self):
        return self._chapter_identifier

    @property
    def title_id(self):
        return self._manga_id

    @property
    def manga_title(self):
        return self._manga_title

    @property
    def manga_url(self):
        return self._manga_url

    @property
    def group(self):
        return self._group

    @property
    def title(self):
        return self.chapter_title or f'{"Volume " + str(self.volume) + ", " if self.volume is not None else ""}Chapter {self.chapter_number}{"" if not self.decimal else "." + str(self.decimal)}'


class MangaDex(BaseScraper):
    URL = 'https://mangadex.org'
    CHAPTER_REGEX = re.compile(r'(?P<manga_title>.+) -($| (((?:Volume (?P<volume>\d+),? )?Chapter (?P<chapter>\d+)(?:\.?(?P<decimal>\d+))?)|(?:(?P<chapter_title>.+?)(( - )?Oneshot)?)$))')
    DESCRIPTION_REGEX = re.compile(r'Group: (?P<group>.+?) - Uploader: (?P<uploader>.+?) - Language: (?P<language>\w+)')
    UPDATE_INTERVAL = timedelta(minutes=30)
    MANGADEX_API = 'https://mangadex.org/api'
    CHAPTER_URL_FORMAT = 'https://mangadex.org/chapter/{}'
    MANGA_URL_FORMAT = 'https://mangadex.org/title/{}'

    @staticmethod
    def min_update_interval():
        return MangaDex.UPDATE_INTERVAL

    def scrape_series(self, *args):
        pass

    def scrape_service(self, service_id, feed_url, last_update, title_id=None):
        feed = feedparser.parse(feed_url if not title_id else feed_url + f'/manga_id/{title_id}')
        try:
            is_valid_feed(feed)
        except (FeedHttpError, InvalidFeedError):
            logger.exception(f'Failed to fetch feed {feed_url}')

            try:
                self.dbutil.update_service_whole(None, service_id, self.min_update_interval())
            except psycopg2.Error:
                logger.exception(f'Failed to update service {feed_url}')
            return

        with self.conn as conn:
            with conn.cursor() as cur:
                sql = 'SELECT last_id::int FROM service_whole WHERE service_id=%s'
                cur.execute(sql, (service_id,))
                last_id = cur.fetchone()[0]

        titles = {}

        def get_id(entry_):
            return int(entry_.id.split('/')[-1])

        def comp_id(entry_id, last_id):
            return entry_id <= last_id

        # Get chapters only past the point of the latest chapter to reduce
        # the amount chapter ids increase in the database when conflict happens
        entries = get_latest_entries(feed.entries, last_id, get_id, comp_id)

        if not entries:
            logger.info('No new entries found')
            try:
                self.dbutil.update_service_whole(None, service_id, self.min_update_interval())
            except psycopg2.Error:
                logger.exception(f'Failed to update service {feed_url}')
            return

        for post in entries:
            title = post.get('title', '')
            m = self.CHAPTER_REGEX.match(title)
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
            match = self.DESCRIPTION_REGEX.match(post.get('description', ''))
            if match:
                kwargs.update(match.groupdict())

            if manga_id in titles:
                titles[manga_id].append(Chapter(**kwargs))
            else:
                titles[manga_id] = [Chapter(**kwargs)]

        if not titles:
            try:
                self.dbutil.update_service_whole(None, service_id, self.min_update_interval())
            except psycopg2.Error:
                logger.exception(f'Failed to update service {feed_url}')
            return

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

                sql = 'UPDATE service_whole SET last_id=%s WHERE service_id=%s'
                cur.execute(sql, (str(get_id(feed.entries[0])), service_id))
                self.dbutil.update_service_whole(cur, service_id, self.UPDATE_INTERVAL)

        return manga_ids

    def update_chapter_infos(self, title_ids, chapter_ids):
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
                logger.error(f'Failed to json decode {r.content}')
                fails += 1
                if fails > 2:
                    return
                continue

            if data.get('status') != 'OK':
                fails += 1
                if fails > 2:
                    return
                continue

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
        raise NotImplementedError('Mangadex needs to be added manually as you need a valid rss feed url')
