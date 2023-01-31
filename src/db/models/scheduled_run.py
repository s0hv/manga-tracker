from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from src.utils.utilities import utcnow


class ScheduledRun(BaseModel):
    manga_id: int
    service_id: int
    created_by: Optional[int]
    created_at: datetime = Field(default_factory=utcnow)


class ScheduledRunResult(BaseModel):
    manga_id: int
    service_id: int
    title_id: Optional[str]
