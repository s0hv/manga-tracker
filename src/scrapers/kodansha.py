# type: ignore
# module retired as scraping kodansha website became too difficult/impossible
import logging
import re
import warnings
from datetime import timedelta, datetime
from typing import Optional, Collection, List, Pattern, ClassVar

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
    SPECIAL_RE: ClassVar[Pattern] = re.compile(r'(?:ex)?\+?(\d+)\+?(?:ex)?', re.I)

    def __init__(self, manga_element: etree.ElementBase, release_interval: timedelta):
        title = manga_element.cssselect('cite')[0].text
        self.chapter_decimal: Optional[int] = None

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
            latest_chapter = -1
        else:
            latest_chapter = int(ch[0])

        if len(ch) > 1:
            self.chapter_decimal = int(ch[1])
        self.author = manga_element.cssselect('.proper-noun')[0].text
        title_id = manga_element.cssselect('.card__link')[0].attrib['href'].strip('/').split('/')[-1]
        self.sources = [Source(elem, self) for elem in manga_element.cssselect('.simulpub-card__partners li a')]

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
    ID = 4
    URL = 'https://kodanshacomics.com'
    FEED_URL = 'https://kodanshacomics.com/simulpubs'
    NAME = 'Kodansha Comics'
    MANGA_URL_FORMAT = 'https://kodanshacomics.com/series/{}'

    def __init__(self, conn, dbutil):
        warnings.warn("Support for kodansha has been dropped", DeprecationWarning)
        super().__init__(conn, dbutil)

    @staticmethod
    def min_update_interval() -> timedelta:
        return random_timedelta(timedelta(hours=1), timedelta(hours=2))

    def scrape_series(self, title_id: str, service_id: int, manga_id: Optional[int], feed_url: str = None) -> Optional[bool]:
        if feed_url is None:
            raise ValueError('Feed url was None')

        retval = self._scrape_service(service_id, feed_url, only_title_ids={title_id}, forced=True)
        return bool(retval) if retval is not None else retval

    def set_checked(self, service_id: int) -> None:
        try:
            super().set_checked(service_id)
            self.dbutil.update_service_whole(service_id, self.min_update_interval())
        except psycopg2.Error:
            logger.exception(f'Failed to update service {service_id}')

    @staticmethod
    def parse_manga_from_html(html: str) -> Optional[List[Manga]]:
        root = etree.HTML(html)

        manga_intervals = root.cssselect('.simulpubs__list-sections .simulpubs-list-section')
        if not manga_intervals:
            logger.warning(f'No manga found for {KodanshaComics.URL}')
            return None

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

        return mangas

    def _scrape_service(self, service_id: int, feed_url: str,
                        only_title_ids: Collection[str] = None, forced: bool = False):
        """

        Args:
            service_id ():
            feed_url ():
            only_title_ids (): Only update these title ids
            forced (): If update is forced even when no new chapter is found
        """
        r = requests.get(feed_url)
        if r.status_code != 200:
            return

        mangas = self.parse_manga_from_html(r.text)
        if mangas is None:
            return

        old_manga = self.dbutil.get_service_manga(service_id)
        old_manga = {r['title_id']: r for r in old_manga}
        new_series = {manga.title_id: manga for manga in mangas if manga.title_id not in old_manga}
        mangas_to_update = []
        for manga in mangas:
            if manga.title_id in old_manga and (forced or manga.has_new_chapter(old_manga[manga.title_id])):
                if only_title_ids and manga.title_id not in only_title_ids:
                    continue

                mangas_to_update.append(manga)
                manga.manga_id = old_manga[manga.title_id]['manga_id']

        if new_series:
            with self.conn:
                with self.conn.cursor() as cur:
                    new_manga = {manga.title_id: [Chapter(manga)] for manga in new_series.values()}
                    """for manga_id, chapters in self.dbutil.add_new_series(cur, new_manga, service_id, disable_single_update=True):
                        manga = new_series[chapters[0].title_id]
                        manga.manga_id = manga_id

                        if only_title_ids and manga.title_id not in only_title_ids:
                            continue

                        mangas_to_update.append(manga)"""

        scrapers = {}
        updated_manga: List[Manga] = []
        logger.info('%s manga to update on kodansha', len(mangas_to_update))

        for manga in mangas_to_update:
            if len(updated_manga) >= 8:
                break
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
            logger.info('%s manga actually updated on kodansha', len(updated_manga))
            with self.conn:
                with self.conn.cursor() as cur:
                    self.dbutil.update_latest_chapter([(m.manga_id, m.latest_chapter, m.release_date) for m in updated_manga], cur=cur)
                    sql = 'UPDATE manga_service ms SET last_check=CURRENT_TIMESTAMP, latest_chapter=c.latest_chapter, latest_decimal=c.latest_decimal::int ' \
                          f'FROM (VALUES %s) as c(latest_chapter, latest_decimal, service_id, manga_id) ' \
                          'WHERE ms.service_id=c.service_id AND ms.manga_id=c.manga_id'
                    execute_values(cur, sql, ((m.latest_chapter, m.chapter_decimal, service_id, m.manga_id) for m in updated_manga))

        return {m.manga_id for m in updated_manga}

    def scrape_service(self, service_id: int, feed_url: str,
                       last_update: Optional[datetime], title_id: Optional[str] = None):
        return self._scrape_service(service_id, feed_url)

    def add_service(self) -> Optional[int]:
        return self.add_service_whole()
