import logging
import re
from datetime import datetime, timedelta
from time import mktime

import feedparser
from psycopg2.extras import execute_batch

from src.scrapers.base_scraper import BaseScraper, BaseChapter
from src.utils.utilities import add_new_series

logger = logging.getLogger('debug')


class Chapter(BaseChapter):
    def __init__(self, chapter, chapter_identifier, manga_id, manga_title,
                 manga_url, chapter_title=None, release_date=None, volume=None,
                 decimal=None, group=None, **kwargs):
        self._chapter_title = chapter_title or None
        self._chapter_number = int(chapter) if chapter else 0
        self._volume = int(volume) if volume is not None else None
        self._decimal = int(decimal) if decimal else None
        self._release_date = datetime.fromtimestamp(mktime(release_date)) if release_date else datetime.utcnow()
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
        return self._group

    @property
    def title(self):
        return self.chapter_title or f'{"Volume " + str(self.volume) + ", " if self.volume is not None else ""}Chapter {self.chapter_number}{"" if not self.decimal else "." + str(self.decimal)}'


class MangaDex(BaseScraper):
    URL = 'https://mangadex.org'
    CHAPTER_REGEX = re.compile(r'(?P<manga_title>.+) -($| (((?:Volume (?P<volume>\d+),? )?Chapter (?P<chapter>\d+)(?:\.?(?P<decimal>\d+))?)|(?:(?P<chapter_title>.+?)(( - )?Oneshot)?)$))')
    DESCRIPTION_REGEX = re.compile(r'Group: (?P<group>.+?) - Uploader: (?P<uploader>.+?) - Language: (?P<language>\w+)')

    def scrape_series(self, *args):
        pass

    def scrape_service(self, service_id, feed_url, last_update, title_id=None):
        feed = feedparser.parse(feed_url if not title_id else feed_url + f'/manga_id/{title_id}')
        titles = {}
        for post in feed.entries:
            m = self.CHAPTER_REGEX.match(post.get('title', ''))
            if not m:
                logger.warning(f'Could not parse title from {post}')
                continue

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
            return

        format_ids = ','.join(['%s'] * len(titles))
        sql = f'SELECT manga_id, title_id FROM manga_service WHERE title_id IN ({format_ids})'
        data = []
        manga_ids = set()
        with self.conn.cursor() as cur:
            cur.execute(sql, tuple(titles.keys()))
            for row in cur:
                manga_id = row['manga_id']
                manga_ids.add(manga_id)
                for chapter in titles.pop(row['title_id']):
                    data.append((manga_id, service_id, chapter.title, chapter.chapter_number,
                                 chapter.decimal, chapter.chapter_identifier,
                                 chapter.release_date, chapter.group))

        with self.conn.cursor() as cur:
            for manga_id, chapters in add_new_series(cur, titles, service_id, True):
                manga_ids.add(manga_id)
                for chapter in chapters:
                    data.append((manga_id, service_id, chapter.title, chapter.chapter_number,
                                chapter.decimal, chapter.chapter_identifier,
                                 chapter.release_date, chapter.group))

        self.conn.commit()

        sql = 'INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_decimal, chapter_identifier, release_date, "group") VALUES ' \
              '(%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING RETURNING manga_id'

        with self.conn.cursor() as cur:
            execute_batch(cur, sql, data, len(data))
            manga_ids = {r['manga_id'] for r in cur}
            if manga_ids:
                format_ids = ','.join(['%s'] * len(manga_ids))
                sql = 'UPDATE manga m SET latest_release=c.release_date FROM ' \
                     f'(SELECT MAX(release_date), manga_id FROM chapters WHERE manga_id IN ({format_ids}) GROUP BY manga_id) as c(release_date, manga_id)' \
                      'WHERE m.manga_id=c.manga_id'
                cur.execute(sql, [(m,) for m in manga_ids])

            sql = 'UPDATE services SET last_check=%s WHERE service_id=%s'
            now = datetime.utcnow()
            cur.execute(sql, [now, service_id])

            sql = 'UPDATE service_whole SET last_check=%s, next_update=%s WHERE service_id=%s'
            cur.execute(sql, [now, now + timedelta(hours=2), service_id])

        self.conn.commit()
        return manga_ids
