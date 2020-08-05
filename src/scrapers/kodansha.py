import logging
import re
from datetime import timedelta, datetime
from typing import Optional

import psycopg2
import requests
from lxml import etree
from psycopg2.extras import execute_values

from src.scrapers.base_scraper import BaseScraper, BaseChapter
from src.utils.utilities import random_timedelta

logger = logging.getLogger('debug')


class Source:
    def __init__(self, source_element, manga):
        self.manga_url = source_element.attrib['href']
        self.base_url = '/'.join(self.manga_url.split('/')[:3])
        self.manga = manga

    @property
    def manga_id(self):
        return self.manga.manga_id


class Manga:
    SPECIAL_RE = re.compile(r'(?:ex)?\+?(\d+)\+?(?:ex)?', re.I)

    def __init__(self, manga_element: etree.ElementBase, release_interval: timedelta):
        self.title = manga_element.cssselect('cite')[0].text
        self.chapter_decimal = None

        ch = manga_element.cssselect('.simulpub-card__badge span')[0].text

        match = None
        if 'ex' in ch.lower():
            match = self.SPECIAL_RE.match(ch)

        if match:
            ch = match.groups()
            self.chapter_decimal = 5
        else:
            ch = ch.split('.')

        # If special chapter, set latest chapter to -1
        if 'ex' in ch[0].lower():
            self.latest_chapter = -1
        else:
            self.latest_chapter = int(ch[0])

        if len(ch) > 1:
            self.chapter_decimal = int(ch[1])
        self.author = manga_element.cssselect('.proper-noun')[0].text
        self.title_id = manga_element.cssselect('.card__link')[0].attrib['href'].strip('/').split('/')[-1]
        self.sources = [Source(elem, self) for elem in manga_element.cssselect('.simulpub-card__partners li a')]

        self.manga_id = None
        self.release_interval = release_interval
        self.release_date = datetime.utcnow()

    def has_new_chapter(self, row):
        return row['latest_chapter'] != self.latest_chapter or (
                row['latest_chapter'] == self.latest_chapter and row['latest_decimal'] != self.chapter_decimal
        )

    def __repr__(self):
        return f'{self.title} by {self.author}'


class Chapter(BaseChapter):
    def __init__(self, manga: Manga):
        self._title_id = manga.title_id
        self._manga_title = manga.title

    @property
    def title_id(self) -> str:
        return self._title_id

    @property
    def manga_title(self) -> str:
        return self._manga_title

    @property
    def chapter_title(self) -> None:
        return None

    @property
    def chapter_number(self) -> None:
        return

    @property
    def volume(self) -> None:
        return

    @property
    def decimal(self) -> None:
        return

    @property
    def release_date(self) -> None:
        return

    @property
    def chapter_identifier(self) -> None:
        return

    @property
    def manga_url(self) -> None:
        return

    @property
    def group(self) -> None:
        return

    @property
    def title(self) -> str:
        return ''


class KodanshaComics(BaseScraper):
    URL = 'https://kodanshacomics.com'
    FEED_URL = 'https://kodanshacomics.com/simulpubs'
    NAME = 'Kodansha Comics'
    MANGA_URL_FORMAT = 'https://kodanshacomics.com/series/{}'

    @staticmethod
    def min_update_interval() -> timedelta:
        return random_timedelta(timedelta(hours=1), timedelta(hours=2))

    def scrape_series(self, title_id, service_id, manga_id) -> None:
        return

    def set_checked(self, service_id: int) -> None:
        try:
            super().set_checked(service_id)
            self.dbutil.update_service_whole(service_id, self.min_update_interval())
        except psycopg2.Error:
            logger.exception(f'Failed to update service {service_id}')

    def scrape_service(self, service_id: int, feed_url: str, last_update: Optional[datetime], title_id: Optional[str] = None):
        r = requests.get(feed_url)
        if r.status_code != 200:
            return

        root = etree.HTML(r.text)

        manga_intervals = root.cssselect('.simulpubs__list-sections .simulpubs-list-section')
        if not manga_intervals:
            logger.warning(f'No manga found for {self.URL}')
            return

        mangas = []

        for manga_elements in manga_intervals:
            release_interval = manga_elements.cssselect('.simulpubs-list-section__header h2 strong')
            if not release_interval:
                logger.warning('No release interval found')
                continue

            release_interval = release_interval[0].text.lower()
            if 'week' in release_interval:
                release_interval = timedelta(days=7)
            elif 'month' in release_interval:
                release_interval = timedelta(days=30)
            else:
                logger.warning("Release interval doesn't contain week or month")
                continue

            manga_elements = manga_elements.cssselect('.card.simulpub-card')
            for manga_element in manga_elements:
                manga = Manga(manga_element, release_interval)
                mangas.append(manga)

        old_manga = self.dbutil.get_service_manga(service_id)
        old_manga = {r['title_id']: r for r in old_manga}
        new_series = {manga.title_id: manga for manga in mangas if manga.title_id not in old_manga}
        mangas_to_update = []
        for manga in mangas:
            if manga.title_id in old_manga and manga.has_new_chapter(old_manga[manga.title_id]):
                mangas_to_update.append(manga)
                manga.manga_id = old_manga[manga.title_id]['manga_id']

        if new_series:
            with self.conn:
                with self.conn.cursor() as cur:
                    new_manga = {manga.title_id: [Chapter(manga)] for manga in new_series.values()}
                    for manga_id, chapters in self.dbutil.add_new_series(cur, new_manga, service_id, disable_single_update=True):
                        manga = new_series[chapters[0].title_id]
                        manga.manga_id = manga_id
                        mangas_to_update.append(manga)

        scrapers = {}
        updated_manga = []
        logger.info('%s manga to update on kodansha', len(mangas_to_update))
        for manga in mangas_to_update[:8]:
            updated = 0
            non_existing = 0
            for source in manga.sources:
                if source.base_url not in scrapers:
                    # Avoid circular import by doing the import in a function
                    from src.scrapers import SCRAPERS

                    Scraper = SCRAPERS.get(source.base_url)
                    if not Scraper:
                        # If scraper doesn't exist we count it as updated
                        non_existing += 1
                        #logger.debug(f'Scraper {source.base_url} not found')
                        continue

                    scraper = Scraper(self.conn, self.dbutil)
                    scrapers[source.base_url] = scraper
                    if not getattr(scraper, 'update_selected_manga', None):
                        logger.warning(f'Required method not found for {scraper.URL}')
                        continue

                scraper = scrapers[source.base_url]
                try:
                    updated_count = scraper.update_selected_manga((source,))
                except:
                    logger.exception(f'Failed to update service {source.manga_url}')
                    continue

                # Only increase if update was done
                if updated_count > 0:
                    updated += 1

            if 0 < updated and updated >= len(manga.sources) - non_existing:
                updated_manga.append(manga)

        if updated_manga:
            logger.info('%s manga actually updated on kodansha', len(mangas_to_update))
            with self.conn:
                with self.conn.cursor() as cur:
                    self.dbutil.update_latest_chapter(cur, [(m.manga_id, m.latest_chapter, m.release_date) for m in updated_manga])
                    sql = 'UPDATE manga_service ms SET last_check=CURRENT_TIMESTAMP, latest_chapter=c.latest_chapter ' \
                          f'FROM (VALUES %s) as c(latest_chapter, latest_decimal, service_id, manga_id)' \
                          'WHERE ms.service_id=c.service_id AND ms.manga_id=c.manga_id'
                    execute_values(cur, sql, ((m.latest_chapter, m.chapter_decimal, service_id, m.manga_id) for m in updated_manga))

        return {m.manga_id for m in updated_manga}

    def add_service(self) -> Optional[int]:
        return self.add_service_whole()
