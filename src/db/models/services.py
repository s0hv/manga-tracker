from datetime import datetime, timedelta

from pydantic import BaseModel


class Service(BaseModel):
    service_id: int
    service_name: str
    url: str
    disabled: bool = False
    chapter_url_format: str = ''
    manga_url_format: str = ''
    disabled_until: datetime | None = None
    last_check: datetime | None = None


class ServiceWhole(BaseModel):
    service_id: int
    feed_url: str
    last_check: datetime | None = None
    next_update: datetime | None = None
    last_id: str | None = None


class ServiceConfig(BaseModel):
    service_id: int
    check_interval: timedelta = timedelta(hours=1)
    scheduled_run_limit: int = 5
    scheduled_runs_enabled: bool = True
    scheduled_run_min_interval: timedelta = timedelta(hours=1)
