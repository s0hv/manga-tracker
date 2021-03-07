import logging
import re
import time
from datetime import timedelta, datetime
from typing import Optional, Iterable, Union, List

import requests
from lxml import etree
from psycopg2.extras import execute_values

from src.scrapers.base_scraper import BaseScraper, BaseChapter
from src.utils.dbutils import DbUtil
from src.utils.utilities import random_timedelta

logger = logging.getLogger('debug')
title_regex = re.compile(r'https:\\/\\/www\.comixology\.com\\/cart\\/add\\/subscription\\/(\d+)\\/0\?actionType=comic&actionId=\d+')
extra_regex = re.compile(r'.+? extra (\d+)\.(\d+)', re.I)
extra_chapter_regex = re.compile(r'extra, (\d+)\.?(\d+)?', re.I)


class Chapter(BaseChapter):
    def __init__(self, chapter_element: etree.ElementBase, manga_title: str):
        title = chapter_element.cssselect('.content-info .content-subtitle')[0].text or ''
        title = title.strip()

        if title.lower().startswith('vol'):
            self.invalid = True
            return
        self.invalid = False

        ch = title.split('#')[-1].split('.')
        if not title:
            title = chapter_element.cssselect('.content-info .content-title')[0].text or ''
            match = extra_regex.match(title)
            if match:
                ch = match.groups()
            elif not title.lower().endswith('extra'):
                logger.warning(f'Empty title for {manga_title} actual title {title}. Might be an extra issue')
            title = title.split(':')[-1] if ':' in title else 'Extra'

        special_match = extra_chapter_regex.match(ch[0])
        if special_match:
            ch = special_match.groups()

        try:
            self._chapter_number = int(ch[0] or 0)
        except ValueError:
            self._chapter_number = 0
        self._chapter_decimal = None
        if len(ch) > 1 and ch[1] is not None:
            self._chapter_decimal = int(ch[1])

        self._title = title
        self.url = chapter_element.cssselect('a.content-details')[0].attrib['href']
        self._chapter_identifier = chapter_element.cssselect('a.content-details')[0].attrib['href'].split('/')[-1]

        title_id = chapter_element.cssselect('.action-button.expand-action')[0].attrib.get('data-expand-menu-data', '')
        found = title_regex.findall(title_id)
        if not found:
            raise ValueError('Title id not found for comiXology chapter')

        if len(found) > 1:
            logger.warning(f'Multiple title ids found for {self.url}')

        self._title_id = found[0]
        self._manga_title = manga_title
        self.release_date_maybe = None

    def __repr__(self) -> str:
        return f'{self.manga_title} chapter {self.chapter_number}: {self.title}'

    @property
    def chapter_title(self) -> str:
        return self._title

    @property
    def chapter_number(self) -> int:
        return self._chapter_number

    @property
    def volume(self) -> None:
        return None

    @property
    def decimal(self) -> Optional[int]:
        return self._chapter_decimal

    @property
    def release_date(self) -> Optional[datetime]:
        return self.release_date_maybe

    @property
    def chapter_identifier(self) -> str:
        return self._chapter_identifier

    @property
    def title_id(self) -> str:
        return self._title_id

    @property
    def manga_title(self) -> str:
        return self._manga_title

    @property
    def manga_url(self) -> None:
        return None

    @property
    def group(self) -> str:
        return 'comiXology'

    @property
    def title(self) -> str:
        return self.chapter_title


class ComiXology(BaseScraper):
    ID = 5
    URL = 'https://www.comixology.com'
    NAME = 'ComiXology'
    CHAPTER_URL_FORMAT = 'https://www.comixology.com/chapter/digital-comic/{}'
    MANGA_URL_FORMAT = 'https://www.comixology.com/series/comics-series/{}'

    def __init__(self, conn, dbutil: DbUtil):
        super().__init__(conn, dbutil)
        self.service_id = None

    @staticmethod
    def min_update_interval() -> timedelta:
        return random_timedelta(timedelta(hours=1), timedelta(hours=2))

    @staticmethod
    def wait() -> None:
        time.sleep(random_timedelta(timedelta(seconds=2), timedelta(seconds=10)).total_seconds())

    def scrape_series(self, title_id, service_id, manga_id, feed_url=None):
        pass

    def scrape_service(self, service_id, feed_url, last_update, title_id=None):
        pass

    def get_chapter_release_date(self, url: str) -> Optional[datetime]:
        r = requests.get(url)
        if r.status_code == 429:
            logger.error(f'Ratelimited on {self.URL}')
            return

        if r.status_code != 200:
            return

        root = etree.HTML(r.text)
        children = root.cssselect('.credits')[0].getchildren()

        for idx, c in enumerate(children):
            if 'digital release date' not in (c.text or '').lower().strip():
                continue

            d = children[idx + 1]
            try:
                return datetime.strptime(d.text, '%B %d %Y')
            except ValueError:
                logger.exception(f'Failed to convert release date to datetime, "{d.text}"')
                continue
            except IndexError:
                return

    def update_selected_manga(self, manga_links: Iterable) -> Union[None, int, bool]:
        now = datetime.utcnow()
        updated = 0
        if self.service_id is None:
            service = self.dbutil.get_service(self.URL)
            self.service_id = service.service_id if service else None

        if not self.service_id:
            logger.warning(f'No service found with {self.URL}')
            return

        for source in manga_links:
            manga = source.manga
            r = requests.get(source.manga_url)
            if r.status_code == 429:
                logger.error(f'Ratelimited on {self.URL}')
                return False

            if r.status_code != 200:
                self.wait()
                continue

            root = etree.HTML(r.text)
            chapter_elements = root.cssselect('.list-content.item-list li.content-item')
            if not chapter_elements:
                logger.warning(f'No chapters found for {source.manga_url}')
                self.wait()
                continue

            chapters = []
            for c in chapter_elements:
                c = Chapter(c, manga.title)
                if c.invalid:
                    continue
                chapters.append(c)

            manga_id = manga.manga_id

            # Check if any new chapters
            new_chapters: List[Chapter] = list(self.dbutil.get_only_latest_entries(self.service_id, chapters, manga_id=manga_id))

            if not new_chapters:
                continue

            logger.info('Adding %s chapters to comixology with manga id %s, %s',
                        len(new_chapters), manga_id, manga.title)

            latest_chapter = manga.latest_chapter
            # If special chapter like extra manually get latest chapter
            if latest_chapter == -1:
                latest_chapter = max(chapters, key=lambda c: c.chapter_number)

            chapters = list(sorted(chapters, key=Chapter.chapter_number.fget, reverse=True))

            if len(new_chapters) > 1:
                if chapters[0].chapter_number < latest_chapter:
                    logger.warning(f'Latest chapter not the last element of chapters list when scraping {manga}')
                else:
                    now = self.get_chapter_release_date(chapters[0].url) or now
            elif len(new_chapters) == 1:
                now = self.get_chapter_release_date(new_chapters[0].url) or now

            # If new chapters existed use ALL CHAPTERS!!! to calculate release dates for every chapter
            last_chapter = None
            for idx, chapter in enumerate(chapters):
                if chapter.invalid:
                    continue

                chapter.release_date_maybe = now

                # If extra set chapter number as previous chapter
                if chapter.chapter_number == 0 and idx + 1 != len(chapters):
                    chapter._chapter_number = chapters[idx + 1].chapter_number
                    chapter._chapter_decimal = 5

                if last_chapter:
                    if not (chapter.chapter_number == last_chapter.chapter_number and chapter.decimal != last_chapter.decimal) and \
                            chapter.chapter_number != 0 and last_chapter.chapter_number - chapter.chapter_number > 1:
                        offset = latest_chapter - chapter.chapter_number
                        chapter.release_date_maybe = now - manga.release_interval * offset
                    else:
                        chapter.release_date_maybe = last_chapter.release_date_maybe - manga.release_interval

                last_chapter = chapter

            manga.release_date = now
            sql = 'INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_decimal, chapter_identifier, release_date, "group") ' \
                  'VALUES %s ON CONFLICT DO NOTHING'

            args = []
            # Turn new chapters into args
            for c in new_chapters:
                if c.invalid:
                    continue
                args.append((manga_id, self.service_id, c.title, c.chapter_number, c.decimal, c.chapter_identifier, c.release_date, 'comiXology'))

            with self.conn:
                with self.conn.cursor() as cur:
                    if args:
                        execute_values(cur, sql, args, page_size=200)

                    sql = 'INSERT INTO manga_service (manga_id, service_id, disabled, last_check, title_id) VALUES ' \
                          '(%s, %s, TRUE, CURRENT_TIMESTAMP, %s) ON CONFLICT (manga_id, service_id) DO UPDATE SET ' \
                          'last_check=EXCLUDED.last_check'
                    cur.execute(sql, (manga.manga_id, self.service_id, manga.title_id))

            self.wait()
            updated += 1

        self.set_checked(self.service_id)
        return updated
