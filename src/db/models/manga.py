from collections.abc import Iterable
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Self, override

from psycopg import Connection
from psycopg.rows import DictRow
from pydantic import BaseModel, Field

from src.utils.utilities import utcnow

if TYPE_CHECKING:
    from src.scrapers.base_scraper import BaseScraper
    from src.utils.dbutils import DbUtil


class Manga(BaseModel):
    manga_id: int | None = None
    title: str
    release_interval: timedelta | None = None
    latest_release: datetime | None = None
    estimated_release: datetime | None = None
    latest_chapter: int | None = None
    views: int = 0


class MangaWithId(Manga):
    manga_id: int


class MangaForNotifications(BaseModel):
    manga_id: int
    title: str
    cover: str | None = None
    title_id: str
    service_id: int


class MangaInfo(BaseModel):
    manga_id: int
    cover: str | None = None
    status: int = 0
    artist: str | None = None
    author: str | None = None
    bw: str | None = None
    mu: str | None = None
    mal: str | None = None
    amz: str | None = None
    ebj: str | None = None
    engtl: str | None = None
    raw: str | None = None
    nu: str | None = None
    kt: str | None = None
    ap: str | None = None
    al: str | None = None
    last_updated: datetime = Field(default_factory=utcnow)


class MangaServicePartial(BaseModel):
    manga_id: int | None = None
    service_id: int
    disabled: bool = False
    title_id: str
    last_check: datetime | None = Field(default_factory=utcnow)
    next_update: datetime | None = None
    feed_url: str | None = None
    latest_decimal: int | None = None

    @classmethod
    def from_manga_service(cls, manga_service: 'MangaService') -> Self:
        return cls.model_validate(manga_service.model_dump())

    # Returns a class initializer so it is named as a class would
    # noinspection PyPep8Naming
    @property
    def Scraper(self) -> type['BaseScraper']:
        from src.scrapers import SCRAPERS_ID

        return SCRAPERS_ID[self.service_id]

    def scrape_series(self, conn: Connection[DictRow], dbutil: 'DbUtil') -> set[int] | None:
        if self.manga_id is None or self.feed_url is None:
            raise ValueError('Manga id or feed url was None')
        scraper = self.Scraper(conn, dbutil)
        return scraper.scrape_series(self.title_id, self.service_id, self.manga_id, self.feed_url)


class MangaServicePartialWithId(MangaServicePartial):
    manga_id: int


class MangaService(Manga, MangaServicePartial):
    @classmethod
    def from_partial(cls, manga_service_partial: MangaServicePartial) -> Self:
        return cls.model_validate(manga_service_partial.model_dump())


class MangaServiceWithId(MangaService):
    """
    Manga service object but with guaranteed manga_id
    """

    manga_id: int

    @classmethod
    @override
    def from_manga_service(cls, manga_service: MangaService) -> Self:
        return cls.model_validate(manga_service.model_dump())

    @classmethod
    def from_manga_services(cls, manga_services: Iterable[MangaService]) -> Iterable[Self]:
        return map(cls.from_manga_service, manga_services)
