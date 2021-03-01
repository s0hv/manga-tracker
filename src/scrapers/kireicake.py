import re
from typing import Dict, Optional

from src.scrapers.base_rss import BaseRSS


class KireiCake(BaseRSS):
    ID = 7
    NAME = 'Kirei Cake'
    URL = 'https://kireicake.com'
    FEED_URL = 'https://kireicake.com/feed/'
    CHAPTER_URL_FORMAT = 'https://kireicake.com/?p={}'
    MANGA_URL_FORMAT = 'https://kireicake.com/projects/{}'

    TITLE_REGEX = re.compile(r'(.+?) (?P<chapter_number>\d+)(?:\.(?P<decimal>\d+))?(( . )?(?!ch)[a-z].+?)?$', re.I)

    def get_chapter_id(self, entry: Dict) -> str:
        return entry.get('id', '').split('?p=')[-1]

    def get_chapter_title(self, entry: Dict) -> Optional[str]:
        return None

    def get_title_id(self, entry: Dict) -> str:
        # Replace the name to the form a-b-c by replacing spaces with dash
        # and removing all special characters
        return re.sub('([^a-z]-)+', '', self.get_manga_title(entry).lower().replace(' ', '-'))

    def get_group(self, entry: Dict) -> Optional[str]:
        return self.NAME

    def get_manga_title(self, entry: Dict) -> Optional[str]:
        for tag in entry.get('tags', []):
            name = tag['term']
            if name.lower() == 'projects':
                continue

            return name
