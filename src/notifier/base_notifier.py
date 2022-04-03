from abc import ABC, abstractmethod
from datetime import datetime
from itertools import groupby
from string import Template
from typing import Optional, List, TypeVar, Tuple

from pydantic import BaseModel

from src.db.models.notifications import NotificationOptions, InputField

T = TypeVar('T', str, Optional[str])


class BaseEmbedInputs(BaseModel):
    @classmethod
    def from_input_list(cls, input_fields: List[InputField]):
        d = {i.name: i.value for i in input_fields}
        return cls(**d)


class NotificationMangaService(BaseModel):
    name: str
    url: str
    manga_url_format: str
    chapter_url_format: str

    def to_dict(self, prefix: str = 'PLATFORM_'):
        return {
            prefix + 'NAME': self.name,
            prefix + 'URL': self.url
        }


class NotificationManga(BaseModel):
    name: str
    service: NotificationMangaService
    cover: Optional[str]
    url: str
    manga_id: int

    def to_dict(self, prefix: str = 'MANGA_'):
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

    def to_dict(self):
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


def get_manga_id(chapter: NotificationChapter):
    return chapter.manga.manga_id


def get_release_date(chapter: NotificationChapter):
    return chapter.release_date


def get_chapter_number(chapter: NotificationChapter):
    return float(chapter.chapter_number)


class NotifierBase(ABC):
    @abstractmethod
    def send_notification(self, chapters: List[NotificationChapter],
                          options: NotificationOptions,
                          input_fields: List[InputField]
                          ) -> Tuple[int, bool]:
        raise NotImplementedError

    @staticmethod
    def get_chapters_grouped(chapters: List[NotificationChapter], options: NotificationOptions) -> List[List[NotificationChapter]]:
        groups: List[List[NotificationChapter]]

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

    def format_title(self, msg_format: str, chapters: List[NotificationChapter]):
        titles = ', '.join(set(map(lambda c: c.manga.name, chapters)))
        template = Template(msg_format)
        s = template.safe_substitute(MANGA_TITLES=titles)

        return s

    def sort_chapters(self, chapters: List[NotificationChapter]) -> List[NotificationChapter]:
        return sorted(chapters, key=get_chapter_number)
