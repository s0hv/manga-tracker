from datetime import datetime

from pydantic import BaseModel, Field

from src.db.types import SmallInt
from src.utils.utilities import utcnow


class Chapter(BaseModel):
    chapter_id: int | None = None
    manga_id: int
    service_id: int
    title: str
    chapter_number: int
    chapter_decimal: SmallInt | None = None
    release_date: datetime = Field(default_factory=utcnow)
    chapter_identifier: str
    group: str | None = None
    group_id: int

    def full_chapter_number(self) -> str:
        return f'{self.chapter_number}{f".{self.chapter_decimal}" if self.chapter_decimal is not None else ""}'


class InsertedChapter(BaseModel):
    chapter_id: int
    manga_id: int
    chapter_number: int
    chapter_decimal: SmallInt | None = None
    release_date: datetime
    chapter_identifier: str
