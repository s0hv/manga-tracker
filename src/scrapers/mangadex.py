from src.scrapers.base_scraper import BaseScraper

import logging
import re
from datetime import datetime, timedelta, timezone
from time import mktime
import feedparser
from src.utils.utilities import update_chapter_interval

import requests
from psycopg2.extras import execute_batch
from psycopg2 import OperationalError, DatabaseError

logger = logging.getLogger('debug')


class Chapter:
    def __init__(self, chapter, chapter_identifier, manga_id, manga_title,
                 manga_url, chapter_title=None, release_date=None, volume=None,
                 decimal=None, group=None, **kwargs):
        self.chapter_title = chapter_title or None
        self.chapter = int(chapter) if chapter else 0
        self.volume = int(volume) if volume is not None else None
        self.decimal = int(decimal) if decimal else None
        self.release_date = datetime.fromtimestamp(mktime(release_date)) if release_date else datetime.now()
        self.chapter_identifier = chapter_identifier
        self.manga_id = manga_id
        self.manga_title = manga_title
        self.manga_url = manga_url
        self.group = group

    @property
    def title(self):
        return self.chapter_title or f'{"Volume " + str(self.volume) + ", " if self.volume is not None else ""}Chapter {self.chapter}'


class MangaDex(BaseScraper):
    URL = 'https://mangadex.org'
    CHAPTER_REGEX = re.compile(r'(?P<manga_title>.+?) - (((?:Volume (?P<volume>\d+),? )?Chapter (?P<chapter>\d+)(?:\.?(?P<decimal>\d+))?)|(?:(?P<chapter_title>.+?) -( Oneshot)?)$)')
    DESCRIPTION_REGEX = re.compile(r'Group: (?P<group>.+?) - Uploader: (?P<uploader>.+?) - Language: (?P<language>\w+)')

    def scrape_series(self, *args):
        pass

    def add_new_series(self, chapters: dict, service_id):
        for title_id, chapters_ in chapters.items():
            sql = 'SELECT manga_id FROM manga WHERE LOWER(title)=LOWER(%s) LIMIT 2'
            with self.conn.cursor() as cur:
                chapter = chapters_[0]
                cur.execute(sql, (chapter.manga_title,))
                rows = cur.fetchmany(2)
                if len(rows) == 2:
                    logger.warning(f'Too many matches for manga {chapter.manga_title}')
                    continue

                if rows:
                    row = rows[0]
                    yield row[0], chapters_
                    continue

                sql = '''WITH manga_insert AS ( INSERT INTO manga (title) VALUES (%s) RETURNING manga_id) 
                         INSERT INTO manga_service (manga_id, service_id, url, disabled, last_check, title_id) VALUES 
                         ((SELECT manga_id FROM manga_insert), %s, %s, TRUE, NOW(), %s) RETURNING manga_id'''
                try:
                    cur.execute(sql, (chapter.manga_title,
                                      service_id, chapter.manga_url, chapter.manga_id))
                except (OperationalError, DatabaseError):
                    logger.exception('Failed to insert new manga')
                    continue

                yield cur.fetchone()[0], chapters_
            self.conn.commit()

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
                    data.append((manga_id, service_id, chapter.title, chapter.chapter,
                                 chapter.decimal, chapter.chapter_identifier,
                                 chapter.release_date, chapter.group))

        for manga_id, chapters in self.add_new_series(titles, service_id):
            manga_ids.add(manga_id)
            for chapter in chapters:
                data.append((manga_id, service_id, chapter.title, chapter.chapter,
                            chapter.decimal, chapter.chapter_identifier,
                             chapter.release_date, chapter.group))

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
            now = datetime.now()
            cur.execute(sql, [now, service_id])

            sql = 'UPDATE service_whole SET last_check=%s, next_update=%s WHERE service_id=%s'
            cur.execute(sql, [now, now + timedelta(hours=2), service_id])

        self.conn.commit()
        return manga_ids
