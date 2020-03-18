import logging
import re
from datetime import datetime
from time import mktime

import feedparser
from psycopg2.extras import execute_values

from src.scrapers.base_scraper import BaseScraper, BaseChapter
from src.utils.utilities import (add_new_series, update_service,
                                 find_added_titles,
                                 update_latest_release)

logger = logging.getLogger('debug')


class Chapter(BaseChapter):
    URL_REGEX = re.compile(r'https://jaiminisbox.com/reader/read/(?P<manga_id>.+?)/(?P<chapter_identifier>\w+/\d+/\d+/)')
    MANGA_URL_PREFIX = 'https://jaiminisbox.com/reader/series/{}'

    def __init__(self, chapter_number, url, chapter_title=None,
                 manga_title=None, release_date=None):
        self._chapter_number = chapter_number
        self._chapter_title = chapter_title
        self._manga_title = manga_title
        self._release_date = datetime.fromtimestamp(mktime(release_date)) if release_date else datetime.utcnow()

        m = self.URL_REGEX.match(url)
        m = m.groupdict()
        manga_id = m['manga_id']
        self._manga_url = self.MANGA_URL_PREFIX.format(manga_id)
        self._manga_id = manga_id
        self._chapter_identifier = manga_id + '/' + m['chapter_identifier']

    @property
    def chapter_title(self):
        return self._chapter_title

    @property
    def chapter_number(self):
        return self._chapter_number

    @property
    def volume(self):
        return None

    @property
    def decimal(self):
        return None

    @property
    def release_date(self):
        return self._release_date

    @property
    def chapter_identifier(self):
        return self._chapter_identifier

    @property
    def manga_id(self):
        return self._manga_id

    @property
    def manga_title(self):
        return self._manga_title

    @property
    def manga_url(self):
        return self._manga_url

    @property
    def group(self):
        return "Jaimini's Box"

    @property
    def title(self):
        return self.chapter_title or f'Chapter {self.chapter_number}'


class JaiminisBox(BaseScraper):
    URL = 'https://jaiminisbox.com'
    FEED_URL = 'https://jaiminisbox.com/reader/feeds'
    CHAPTER_REGEX = re.compile(r'(?P<manga_title>.+?) +(?:(?:Chapter|Z=) ?(?P<chapter_number>\d+),?)(?::? (?P<chapter_title>.+))?')

    def scrape_series(self, title_id, service_id, manga_id):
        pass

    def scrape_service(self, service_id, feed_url, last_update, title_id=None):
        feed = feedparser.parse(self.FEED_URL)
        titles = {}
        for post in feed.entries:
            m = self.CHAPTER_REGEX.match(post.get('title', ''))
            if not m:
                logger.warning(f'Could not parse title from {post}')
                continue
            kwargs = m.groupdict()

            kwargs['url'] = post.link
            kwargs['release_date'] = post.published_parsed

            try:
                chapter = Chapter(**kwargs)
            except AttributeError:
                logger.exception('Failed to create chapter')
                continue

            manga_id = chapter.manga_id
            if manga_id in titles:
                titles[manga_id].append(chapter)
            else:
                titles[manga_id] = [chapter]

        if not titles:
            with self.conn.cursor() as cur:
                update_service(cur, service_id, self.UPDATE_INTERVAL)

            self.conn.commit()
            return

        data = []
        manga_ids = set()
        with self.conn.cursor() as cur:
            for row in find_added_titles(cur, tuple(titles.keys())):
                manga_id = row['manga_id']
                manga_ids.add(manga_id)
                for chapter in titles.pop(row['title_id']):
                    data.append((manga_id, service_id, chapter.title, chapter.chapter_number,
                                 chapter.chapter_identifier, chapter.release_date,
                                 chapter.group))

        if titles:
            with self.conn.cursor() as cur:
                for manga_id, chapters in add_new_series(cur, titles, service_id, True):
                    manga_ids.add(manga_id)
                    for chapter in chapters:
                        data.append((manga_id, service_id, chapter.title, chapter.chapter_number,
                                     chapter.chapter_identifier, chapter.release_date,
                                     chapter.group))

            self.conn.commit()

        sql = 'INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_identifier, release_date, "group") VALUES ' \
              '%s ON CONFLICT DO NOTHING RETURNING manga_id'

        with self.conn.cursor() as cur:
            manga_ids = execute_values(cur, sql, data, page_size=len(data), fetch=True)
            manga_ids = {r['manga_id'] for r in manga_ids}
            if manga_ids:
                update_latest_release(cur, [(m,) for m in manga_ids])

            update_service(cur, service_id, self.UPDATE_INTERVAL)

        self.conn.commit()
        return manga_ids
