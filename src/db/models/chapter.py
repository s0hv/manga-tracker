from datetime import datetime
from typing import Optional


class Chapter:
    def __init__(self,
                 chapter_id: Optional[int],
                 manga_id: int,
                 service_id: int,
                 title: str,
                 chapter_number: int,
                 chapter_decimal: Optional[int],
                 release_date: datetime,
                 chapter_identifier: str,
                 group: Optional[str]):
        self._chapter_id = chapter_id
        self._manga_id = manga_id
        self._service_id = service_id
        self._title = title
        self._chapter_number = chapter_number
        self._chapter_decimal = chapter_decimal
        self._release_date = release_date
        self._chapter_identifier = chapter_identifier
        self._group = group

    @property
    def chapter_id(self) -> Optional[int]:
        return self._chapter_id

    @property
    def manga_id(self) -> int:
        return self._manga_id

    @property
    def service_id(self) -> int:
        return self._service_id

    @property
    def title(self) -> str:
        return self._title

    @property
    def chapter_number(self) -> int:
        return self._chapter_number

    @property
    def chapter_decimal(self) -> Optional[int]:
        return self._chapter_decimal

    @property
    def release_date(self) -> datetime:
        return self._release_date

    @property
    def chapter_identifier(self) -> str:
        return self._chapter_identifier

    @property
    def group(self) -> Optional[str]:
        return self._group
