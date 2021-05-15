from datetime import datetime, timedelta
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


class ServiceConfig(BaseModel):
    service_id: int
    check_interval: timedelta = timedelta(hours=1)
    scheduled_run_limit: int = 5
    scheduled_runs_enabled: bool = True
    scheduled_run_min_interval: timedelta = timedelta(hours=1)
