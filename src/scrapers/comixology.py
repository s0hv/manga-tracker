import logging
import re
import time
from datetime import timedelta, datetime
from typing import Optional, List, Set

import requests
from lxml import etree

from src.db.mappers.chapter_mapper import ChapterMapper
from src.scrapers.base_scraper import BaseScraper, BaseChapter
from src.utils.dbutils import DbUtil
from src.utils.utilities import random_timedelta, get_latest_chapters

logger = logging.getLogger('debug')
title_regex = re.compile(r'https:\\/\\/www\.comixology\.com\\/cart\\/add\\/subscription\\/(\d+)\\/0\?actionType=comic&actionId=\d+')
extra_regex = re.compile(r'.+? extra (\d+)\.(\d+)', re.I)
extra_chapter_regex = re.compile(r'extra, (\d+)\.?(\d+)?', re.I)


class Chapter(BaseChapter):
    def __init__(self, chapter_element: etree.ElementBase):
        title = chapter_element.cssselect('.content-info .content-subtitle')[0].text or ''
        title = title.strip()

        if title.lower().startswith('vol'):
            self.invalid = True
            return

        add_to_cart = chapter_element.cssselect('.action-button span.action-title')[0].text
        if add_to_cart.lower() == 'pre-order':
            self.invalid = True
            return

        self.invalid = False

        manga_title = chapter_element.cssselect('.content-title.cu-alc')[0].text

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
            # Not all titles have title id set (probably only applies to newer titles).
            # If not mark as invalid and skip
            self.invalid = True
            logger.debug(f'Title id not found for {self.url}')
            return
            # raise ValueError('Title id not found for comiXology chapter')

        if len(found) > 1:
            logger.warning(f'Multiple title ids found for {self.url}')

        self._title_id = found[0]
        self._manga_title = manga_title
        self.release_date_maybe = None
        self._created_at = datetime.utcnow()

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
    def release_date(self) -> datetime:
        return self.release_date_maybe or self._created_at

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
    FEED_URL = 'https://www.comixology.com/New-Manga-Releases/list/24959'
    NAME = 'ComiXology'
    CHAPTER_URL_FORMAT = 'https://www.comixology.com/chapter/digital-comic/{}'
    MANGA_URL_FORMAT = 'https://www.comixology.com/series/comics-series/{}'

    def __init__(self, conn, dbutil: DbUtil):
        super().__init__(conn, dbutil)
        self.service_id: Optional[int] = None

    @staticmethod
    def min_update_interval() -> timedelta:
        return random_timedelta(timedelta(hours=1), timedelta(hours=2))

    @staticmethod
    def wait() -> None:
        time.sleep(random_timedelta(timedelta(seconds=2), timedelta(seconds=5)).total_seconds())

    def fetch_full_feed(self, feed_url: str) -> Optional[List[Chapter]]:
        try:
            r = requests.get(feed_url)
        except requests.RequestException:
            logger.exception('Failed to fetch ComiXology')
            return None

        if not r.ok:
            logger.error('Failed to fetch ComiXology', r.text)
            return None

        root = etree.HTML(r.text)
        chapter_elements = list(root.cssselect('li.content-item'))
        next_page_link = root.cssselect('.pager-links li a.next-page')

        if next_page_link:
            next_page_url = f'{self.URL}{next_page_link[0].attrib["href"]}'
            time.sleep(1.5)
            try:
                r2 = requests.get(next_page_url)
            except requests.RequestException:
                logger.exception('Failed to fetch page 2 of ComiXology')
            else:
                if not r2.ok:
                    logger.error('Failed to fetch page 2 of ComiXology', r2.text)
                else:
                    root2 = etree.HTML(r2.text)
                    chapter_elements.extend(root2.cssselect('li.content-item'))

        return self.parse_chapters(chapter_elements)

    def scrape_series(self, title_id, service_id, manga_id, feed_url=None):
        raise NotImplementedError()

    def scrape_service(self, service_id, feed_url, last_update, title_id=None):
        chapters = self.fetch_full_feed(feed_url)
        if chapters is None:
            return

        if not chapters:
            logger.info('No chapters found for ComiXology')
            return None

        chapters = self.dbutil.get_only_latest_entries(service_id, chapters, limit=50)

        for idx, chapter in enumerate(chapters):
            date = self.get_chapter_release_date(chapter.url)
            if date is None:
                break

            chapter.release_date_maybe = date
            if idx != len(chapters) - 1:
                self.wait()

        titles = self.group_by_manga(chapters)

        manga_ids: Set[int] = set()
        data = self.map_already_added_titles(service_id, titles, manga_ids)

        # Add new manga
        mangas = self.titles_dict_to_manga_service(titles, service_id, True)

        for manga in self.dbutil.add_new_manga_and_check_duplicate_titles(mangas):
            manga_ids.add(manga.manga_id)
            logger.info('Adding new ComiXology manga (%s) %s', manga.manga_id, manga.title)
            for chapter in titles.get(manga.title_id, []):
                data.append(
                    ChapterMapper.base_chapter_to_db(chapter, manga.manga_id,
                                                     service_id)
                )

        logger.info('Adding %s chapters to ComiXology',
                    len(data))

        self.dbutil.add_chapters(data, fetch=False)

        chapter_rows = [{
            'chapter_decimal': c.chapter_decimal,
            'manga_id': c.manga_id,
            'chapter_number': c.chapter_number,
            'release_date': c.release_date
        } for c in data]
        self.dbutil.update_latest_chapter(tuple(c for c in get_latest_chapters(chapter_rows).values()))

        return manga_ids

    @staticmethod
    def parse_chapters(elements: List[etree.ElementBase]) -> List[Chapter]:
        chapters = []
        for element in elements:
            c = Chapter(element)
            if c.invalid:
                continue

            chapters.append(c)

        return chapters

    def get_chapter_release_date(self, url: str) -> Optional[datetime]:
        try:
            r = requests.get(url)
        except requests.RequestException:
            logger.exception(f'Failed to get chapter id for {url}')
            return None

        if r.status_code == 429:
            logger.error(f'Ratelimited on {self.URL}')
            return None

        if not r.ok:
            return None

        root = etree.HTML(r.text)
        children = root.cssselect('.credits .subtitle,.credits .aboutText')

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
                return None

        return None

    def add_service(self):
        if self.dbutil.get_service(self.ID) is not None and self.dbutil.get_service_whole(self.ID) is None:
            service_id = self.ID
            with self.conn:
                with self.conn.cursor() as cur:
                    sql = 'INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id) VALUES ' \
                          '(%s, %s, NULL, NULL, NULL)'
                    cur.execute(sql, (service_id, self.FEED_URL))

            return service_id
        else:
            super().add_service_whole()
