from typing import Optional

from pydantic import BaseModel


class ScheduledRun(BaseModel):
    manga_id: int
    service_id: int
    created_by: Optional[int]
