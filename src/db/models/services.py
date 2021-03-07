from datetime import datetime
from typing import Optional

from psycopg2.extras import DictRow


class Service:
    def __init__(self,
                 service_id: int,
                 service_name: str,
                 url: str,
                 disabled: bool = False,
                 chapter_url_format: str = '',
                 manga_url_format: str = '',
                 disabled_until: Optional[datetime] = None,
                 last_check: Optional[datetime] = None
                 ):
        self.service_id = service_id
        self.service_name = service_name
        self.url = url
        self.disabled = disabled
        self.chapter_url_format = chapter_url_format
        self.manga_url_format = manga_url_format
        self.disabled_until = disabled_until
        self.last_check = last_check

    @classmethod
    def from_dbrow(cls, row: DictRow):
        return cls(
            **row
        )


class ServiceWhole:
    def __init__(self,
                 service_id: int,
                 feed_url: str,
                 last_check: Optional[datetime] = None,
                 next_update: Optional[datetime] = None,
                 last_id: Optional[str] = None
                 ):
        self.service_id = service_id
        self.feed_url = feed_url
        self.last_check = last_check
        self.next_update = next_update
        self.last_id = last_id

    @classmethod
    def from_dbrow(cls, row: DictRow):
        return cls(
            **row
        )
