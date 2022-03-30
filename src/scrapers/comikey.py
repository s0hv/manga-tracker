import random
import re
import time
from typing import Dict, Optional, Set

import requests

from .base_rss import BaseRSS


class Comikey(BaseRSS):
    ID = 8
    URL = 'https://comikey.com'
    FEED_URL = 'https://comikey.com/sapi/feed.rss'
    CHAPTER_FEED_URL = 'https://comikey.com/sapi/comics/{}/feed.rss'
    TITLE_REGEX = re.compile(r'^(?:(?P<manga_title>.+?) )?(?:chapter|episode|\w+) (?P<chapter_number>\d+)(\.(?P<decimal>\d+))?(?:: (?P<chapter_title>.+?))?$', re.I)
    id_cache: Dict[str, str] = {}
    NAME = 'Comikey'

    def get_chapter_title(self, entry: Dict) -> Optional[str]:
        return None

    def get_real_title_id(self, partial_id: str) -> str:
        if partial_id in self.id_cache:
            return self.id_cache[partial_id]

        r = requests.head(self.URL + f'/comics/{partial_id}', allow_redirects=True)
        real_id = '/'.join(r.url.rstrip('/').split('/')[-2:])
        self.id_cache[partial_id] = real_id
        time.sleep(random.uniform(0.5, 1.5))
        return real_id

    def get_title_id(self, entry: Dict) -> str:
        match = re.search(r'.com/read/((\w|-)+)/', entry['link'])
        if not match:
            raise ValueError(f'Could not parse title id from {entry}')

        title_id = match.group(1)
        if title_id in self.id_cache:
            return self.id_cache[title_id]

        sql = 'SELECT title_id FROM manga_service WHERE service_id=%s AND title_id LIKE %s'
        rows = self.dbutil.execute(sql, (self.ID, f'{title_id}/%'), fetch=True)
        if rows:
            self.id_cache[title_id] = rows[0]['title_id']
            return rows[0]['title_id']

        return self.get_real_title_id(title_id)

    def skip_entry(self, entry: Dict) -> bool:
        chapter_id = self.get_chapter_id(entry).strip('/').split('/')[-1]
        # Skip non english chapters for now
        return re.match(r'^(capitulo-(espanol|portugues)|bab-bahasa)(-|\d)+$', chapter_id, re.I) is not None

    def get_group(self, entry: Dict) -> Optional[str]:
        return self.NAME

    def get_manga_title(self, entry: Dict) -> Optional[str]:
        return None

    def get_chapter_id(self, entry: Dict) -> str:
        # Extract the end part of the url.
        match = re.search(r'.com/read/((?:\w|-)+/(.+?))/?$', entry['link'])
        if not match:
            raise ValueError(f'Could not parse chapter id from {entry}')

        return match.group(1)

    def scrape_series(self, title_id: str, service_id: int, manga_id: int,
                      feed_url: Optional[str] = None) -> Optional[Set[int]]:
        retval = self.add_from_feed_url(
            service_id,
            self.CHAPTER_FEED_URL.format(title_id.split('/')[1])
        )

        return retval if retval is None else retval.chapter_ids
