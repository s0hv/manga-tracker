import logging
import re
import time
import typing
from calendar import timegm
from datetime import datetime, timedelta
from itertools import groupby
from json.decoder import JSONDecodeError
from typing import Dict, Collection, Iterable, Optional, List, Any, Tuple

import feedparser
import psycopg2
import requests
from psycopg2.extras import execute_values

from src.db.mappers.chapter_mapper import ChapterMapper
from src.db.models.chapter import Chapter as ChapterModel
from src.db.models.manga import MangaService
from src.enums import Status
from src.errors import FeedHttpError, InvalidFeedError
from src.scrapers.base_scraper import BaseScraper, BaseChapter
from src.utils.utilities import match_title, is_valid_feed, get_latest_chapters

logger = logging.getLogger('debug')


class Chapter(BaseChapter):
    def __init__(self, chapter: Optional[str], chapter_identifier: str, manga_id: str,
                 manga_title: str, manga_url: str, chapter_title: Optional[str] = None,
                 release_date: Optional[typing.Union[time.struct_time, datetime]] = None,
                 volume: Optional[int] = None, decimal: Optional[int] = None,
                 group: Optional[str] = None, **_):
        self._chapter_title = chapter_title or None
        self._chapter_number = int(chapter) if chapter else 0
        self._volume = int(volume) if volume is not None else None
        self._decimal = int(decimal) if decimal else None

        if isinstance(release_date, time.struct_time):
            self._release_date = datetime.utcfromtimestamp(timegm(release_date))
        else:
            self._release_date = release_date if release_date else datetime.utcnow()

        self._chapter_identifier = str(chapter_identifier)
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
    MANGADEX_API = 'https://api.mangadex.org/v2'
    CHAPTER_URL_FORMAT = 'https://mangadex.org/chapter/{}'
    MANGA_URL_FORMAT = 'https://mangadex.org/title/{}'

    @staticmethod
    def min_update_interval() -> timedelta:
        return MangaDex.UPDATE_INTERVAL

    def scrape_series(self, title_id: str, service_id: int, manga_id: Optional[int], feed_url: str = None):
        url = f'{MangaDex.MANGADEX_API}/manga/{title_id}?include=chapters'
        try:
            r = requests.get(url)
            data = r.json()
        except requests.HTTPError:
            logger.exception(f'Failed to fetch manga from {url}')
            return

        if 'data' not in data or data.get('status', '').upper() != 'OK':
            logger.warning(f'Failed to get manga data from {url}')
            return

        data = data['data']
        manga = data['manga']
        manga_title = manga['title']
        chapters: List[Chapter] = []
        groups = {}

        # Map groups by id
        for group in data['groups']:
            groups[group['id']] = group['name']

        for chapter in data['chapters']:
            if chapter['language'].lower() != 'gb':
                continue

            chapter_number = chapter['chapter'].split('.')
            chapter_decimal = None
            if len(chapter_number) > 1:
                chapter_number, chapter_decimal = chapter_number
            else:
                chapter_number = chapter_number[0]

            c = Chapter(
                chapter_number,
                chapter_identifier=chapter['id'],
                manga_id=title_id,
                manga_title=manga_title,
                manga_url=MangaDex.MANGA_URL_FORMAT.format(title_id),
                chapter_title=chapter['title'],
                release_date=datetime.utcfromtimestamp(chapter['timestamp']),
                volume=chapter['volume'] or None,
                decimal=chapter_decimal,
                group=groups[chapter['groups'][0]]
            )

            chapters.append(c)

        entries: Collection[Chapter] = self.dbutil.get_only_latest_entries(service_id, chapters, manga_id=manga_id)
        all_chapters = set(chapters)
        old_chapters = all_chapters.difference(entries)
        entries: List[Chapter] = list(entries)

        if len(old_chapters) > 0:
            logger.info(f'Updating titles of {len(old_chapters)} existing chapters')
            self.dbutil.update_chapter_titles(service_id, old_chapters)

        if not entries:
            logger.info('No new entries found')
            return False

        logger.info('%s new chapters found. %s', len(entries), [e.chapter_identifier for e in entries])

        manga = self.dbutil.find_service_manga(service_id, title_id)
        if not manga:
            manga_id = self.dbutil.manga_id_from_title(manga_title)
            if manga_id is None:
                manga_service = self.dbutil.add_new_manga(
                    MangaService(
                        service_id=service_id,
                        disabled=True,
                        title_id=title_id,
                        title=manga_title,
                        manga_id=None
                    )
                )
                self.dbutil.add_manga_service(manga_service)
                manga_id = manga_service.manga_id

        if manga_id is None:
            raise ValueError('Manga id not found')

        self.dbutil.add_chapters(entries, manga_id, service_id, fetch=False)
        self.update_chapter_infos([title_id], [c.chapter_identifier for c in entries], service_id)
        return True

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
            match = MangaDex.CHAPTER_REGEX.match(title)
            kwargs: Dict[str, Any] = {}
            if not match:
                m = match_title(title)
                if not m:
                    logger.warning(f'Could not parse title from {title or post}')
                    continue

                logger.info(f'Fallback to universal regex successful on {title or post}')

                kwargs.update(**m)
            else:
                kwargs.update(**match.groupdict())

            kwargs['chapter_identifier'] = post.get('link', '').split('/')[-1]
            manga_id = post.get('mangalink', '').split('/')[-1]

            # In case an invalid entry somehow ended up in the feed
            if manga_id == '0':
                continue

            kwargs['manga_id'] = manga_id

            if not kwargs['manga_id'] or not kwargs['chapter_identifier']:
                logger.warning(f'Could not parse ids from {post}')
                continue

            kwargs['manga_url'] = post.get('mangalink', '')
            kwargs['release_date'] = post.get('published_parsed')
            match = MangaDex.DESCRIPTION_REGEX.match(post.get('description', ''))
            if match:
                kwargs.update(match.groupdict())

            try:
                titles.append(Chapter(**kwargs))
            except:
                logger.exception(f'Failed to parse chapter {post}')
                continue

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

        data: List[ChapterModel] = []
        manga_ids = set()
        mangadex_ids = {}
        for ms in self.dbutil.find_added_titles(service_id, tuple(titles.keys())):
            manga_id = ms.manga_id
            manga_ids.add(manga_id)
            mangadex_ids[manga_id] = ms.title_id
            for chapter in titles.pop(ms.title_id):
                data.append(
                    ChapterMapper.base_chapter_to_db(chapter, manga_id, service_id)
                )

        mangas = self.titles_dict_to_manga_service(titles, service_id, True)

        # Add new manga
        for manga in self.dbutil.add_new_manga_and_check_duplicate_titles(mangas):
            for chapter in titles.get(manga.title_id, []):
                data.append(
                    ChapterMapper.base_chapter_to_db(chapter, manga.manga_id,
                                                     service_id)
                )

        with self.conn:
            with self.conn.cursor() as cur:
                rows = self.dbutil.add_chapters(data, fetch=True, cur=cur)
                if not rows:
                    return manga_ids
                manga_ids = {r['manga_id'] for r in rows}
                if manga_ids:
                    self.dbutil.update_latest_chapter(tuple(c for c in get_latest_chapters(rows).values()), cur=cur)
                    self.update_chapter_infos([mangadex_ids[i] for i in mangadex_ids], [c['chapter_identifier'] for c in rows], service_id)

        return manga_ids

    def update_chapter_infos(self, title_ids: Iterable[str], chapter_ids: Iterable[str], service_id: int):
        """
        Updates chapters with their actual titles using the mangadex api
        Args:
            title_ids: Mangadex title ids
            chapter_ids: Chapter identifiers
            service_id: Id of the mangadex service
        """
        if not title_ids:
            return

        url = self.MANGADEX_API + '/manga/{}?include=chapters'
        headers: Dict[str, str] = {}
        fails = 0
        sleep = 0.1
        chapters: List[Tuple[str, str, int]] = []
        manga_info: List[Tuple[
            Optional[str],
            Optional[str],
            Optional[str],
            Optional[int],
            int,
            str
        ]] = []

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

            data = data.get('data', {})
            manga = data.get('manga', {})
            cover = manga.get('cover_url')
            if cover:
                cover = f'https://mangadex.org/{cover}'

            artist: str = manga.get('artist')
            author: str = manga.get('author')
            status = manga.get('status')
            if status:
                status = Status.from_mangadex(int(status))
            else:
                status = 0

            manga_info.append((
                cover,
                artist,
                author,
                status,
                service_id,
                title_id
            ))

            for chapter in data.get('chapters', []):
                chapter_id = str(chapter['id'])
                if chapter_id not in chapter_ids:
                    continue

                title = chapter.get('title')
                if not title:
                    continue

                chapters.append((
                    title,
                    chapter_id,
                    service_id
                ))

            if idx % 10 == 0:
                time.sleep(1)
                sleep += 0.2
            else:
                time.sleep(sleep)

        if not chapters:
            return

        sql = 'UPDATE chapters SET title=c.title ' \
              'FROM (VALUES %s) as c(title, chapter_identifier, service_id) ' \
              'WHERE chapters.service_id=c.service_id AND c.chapter_identifier=chapters.chapter_identifier'

        info_sql = '''
            INSERT INTO manga_info as mi (manga_id, cover, artist, author, status, last_updated)
                SELECT ms.manga_id, c.cover, c.artist, c.author, c.status, now()
                FROM (VALUES %s) as c(cover, artist, author, status, service_id, title_id)
                    INNER JOIN manga_service ms ON ms.service_id=c.service_id AND ms.title_id=c.title_id
            ON CONFLICT (manga_id) DO UPDATE SET
                cover=COALESCE(EXCLUDED.cover, mi.cover),
                artist=COALESCE(EXCLUDED.artist, mi.artist),
                author=COALESCE(EXCLUDED.author, mi.author),
                status=EXCLUDED.status
        '''

        with self.conn:
            with self.conn.cursor() as cur:
                execute_values(cur, sql, chapters, page_size=500)
                execute_values(cur, info_sql, manga_info, page_size=500)

    def add_service(self):
        self.add_service_whole()
        logger.error('Mangadex feed url must be changed in the service_whole table before use')
