from datetime import datetime

from pydantic import BaseModel, Field, InstanceOf

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


class ChapterFailedBase(BaseModel):
    """
    This class contains information of a chapter that could not be parsed.
    """
    service_id: int
    errors: str
    title: str | None
    manga_id: int | None = None
    chapter_number: int | None = None
    chapter_decimal: SmallInt | None = None
    title_id: str | None = None
    manga_title: str | None = None
    release_date: datetime | None = None
    group: str | None = None
    timestamp: datetime = Field(default_factory=utcnow)
    exception: InstanceOf[Exception] | None = None


class ChapterFailedUnprocessable(ChapterFailedBase):
    chapter_identifier: None = None


class ChapterFailed(ChapterFailedBase):
    chapter_identifier: str


class ChapterAndMangaId(BaseModel):
    chapter_id: int
    manga_id: int
