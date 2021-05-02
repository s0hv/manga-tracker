from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Chapter(BaseModel):
    chapter_id: Optional[int]
    manga_id: int
    service_id: int
    title: str
    chapter_number: int
    chapter_decimal: Optional[int]
    release_date: datetime
    chapter_identifier: str
    group: Optional[str]
