from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Service(BaseModel):
    service_id: int
    service_name: str
    url: str
    disabled: bool = False
    chapter_url_format: str = ''
    manga_url_format: str = ''
    disabled_until: Optional[datetime] = None
    last_check: Optional[datetime] = None


class ServiceWhole(BaseModel):
    service_id: int
    feed_url: str
    last_check: Optional[datetime] = None
    next_update: Optional[datetime] = None
    last_id: Optional[str] = None
