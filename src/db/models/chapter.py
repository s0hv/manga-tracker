from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from src.db.types import SmallInt


class Chapter(BaseModel):
    chapter_id: Optional[int]
    manga_id: int
    service_id: int
    title: str
    chapter_number: int
    chapter_decimal: Optional[SmallInt]
    release_date: datetime = Field(default_factory=datetime.utcnow)
    chapter_identifier: str
    group: Optional[str]
    group_id: int
