from abc import ABC, abstractmethod
from datetime import datetime
from itertools import groupby
from string import Template
from typing import Any, Self, TypeVar

from pydantic import BaseModel

from src.db.models.notifications import InputField, NotificationOptions

T = TypeVar('T', str, str | None)
TEmbedInputs = TypeVar('TEmbedInputs')

Overrides = dict[int, TEmbedInputs]

class BaseEmbedInputs(BaseModel):
    @classmethod
    def from_input_list(cls, input_fields: list[InputField]) -> Self:
        d = {i.name: i.value for i in input_fields if i.override_id is None}
        return cls(**d)

    @classmethod
    def overrides(cls: type[TEmbedInputs], input_fields: list[InputField]) -> Overrides[TEmbedInputs]:
        manga_ids: set[int] = {i.override_id for i in input_fields if i.override_id is not None}

        if not manga_ids:
            return {}

        base_d = {i.name: i.value for i in input_fields if i.override_id is None}
        overrides: dict[int, dict[str, str]] = {}
        for manga_id in manga_ids:
            overrides[manga_id] = {**base_d}

        for field in input_fields:
            if field.override_id is not None:
                overrides[field.override_id][field.name] = field.value

        return {k: cls(**v) for k, v in overrides.items()}


class NotificationMangaService(BaseModel):
    name: str
    url: str
    manga_url_format: str
    chapter_url_format: str

    def to_dict(self, prefix: str = 'PLATFORM_') -> dict[str, str | None]:
        return {
            prefix + 'NAME': self.name,
            prefix + 'URL': self.url
        }


class NotificationManga(BaseModel):
    name: str
    service: NotificationMangaService
    cover: str | None = None
    url: str
    manga_id: int
    title_id: str

    def to_dict(self, prefix: str = 'MANGA_') -> dict[str, str | None]:
        return {
            prefix + 'TITLE': self.name,
            prefix + 'COVER': self.cover,
            prefix + 'URL': self.url
        }


class NotificationChapter(BaseModel):
    manga: NotificationManga
    title: str
    chapter_number: str
    release_date: datetime
    url: str
    group: str

    def to_dict(self) -> dict[str, Any]:
        return {
            'TITLE': self.title,
            'CHAPTER_NUMBER': self.chapter_number,
            'RELEASE_DATE': self.release_date,
            'UNIX_TIMESTAMP': int(self.release_date.timestamp()),
            'URL': self.url,
            'GROUP': self.group,
            **self.manga.to_dict(),
            **self.manga.service.to_dict()
        }


def get_manga_id(chapter: NotificationChapter) -> int:
    return chapter.manga.manga_id


def get_release_date(chapter: NotificationChapter) -> datetime:
    return chapter.release_date


def get_chapter_number(chapter: NotificationChapter) -> float:
    return float(chapter.chapter_number)


class NotifierBase(ABC):
    @abstractmethod
    def send_notification(self, chapters: list[NotificationChapter],
                          options: NotificationOptions,
                          input_fields: list[InputField]
                          ) -> tuple[int, bool]:
        raise NotImplementedError

    @staticmethod
    def get_chapters_grouped(chapters: list[NotificationChapter], options: NotificationOptions) -> list[list[NotificationChapter]]:
        groups: list[list[NotificationChapter]]

        if options.group_by_manga:
            groups = []
            for _, group_it in groupby(sorted(chapters, key=get_manga_id), key=get_manga_id):
                groups.append(list(group_it))
        else:
            groups = [chapters]

        return groups

    def format_string(self, msg_template: T, chapter: NotificationChapter) -> T:
        if not msg_template:
            return msg_template

        template = Template(msg_template)
        return template.safe_substitute(**chapter.to_dict())

    def format_title(self, msg_format: str, chapters: list[NotificationChapter]) -> str:
        titles = ', '.join({c.manga.name for c in chapters})
        template = Template(msg_format)
        s = template.safe_substitute(MANGA_TITLES=titles)

        return s

    def sort_chapters(self, chapters: list[NotificationChapter]) -> list[NotificationChapter]:
        return sorted(chapters, key=get_chapter_number)
