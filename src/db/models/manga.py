from datetime import datetime, timedelta
from typing import Iterable, Optional, TYPE_CHECKING, Type

from psycopg import Connection
from pydantic import BaseModel, Field

from src.utils.utilities import utcnow

if TYPE_CHECKING:
    from src.scrapers.base_scraper import BaseScraper
    from src.utils.dbutils import DbUtil


class Manga(BaseModel):
    manga_id: Optional[int] = None
    title: str
    release_interval: Optional[timedelta] = None
    latest_release: Optional[datetime] = None
    estimated_release: Optional[datetime] = None
    latest_chapter: Optional[int] = None
    views: int = 0


class MangaWithId(Manga):
    manga_id: int


class MangaForNotifications(BaseModel):
    manga_id: int
    title: str
    cover: Optional[str] = None
    title_id: str
    service_id: int


class MangaInfo(BaseModel):
    manga_id: int
    cover: Optional[str] = None
    status: int = 0
    artist: Optional[str] = None
    author: Optional[str] = None
    bw: Optional[str] = None
    mu: Optional[str] = None
    mal: Optional[str] = None
    amz: Optional[str] = None
    ebj: Optional[str] = None
    engtl: Optional[str] = None
    raw: Optional[str] = None
    nu: Optional[str] = None
    kt: Optional[str] = None
    ap: Optional[str] = None
    al: Optional[str] = None
    last_updated: datetime = Field(default_factory=utcnow)


class MangaServicePartial(BaseModel):
    manga_id: Optional[int] = None
    service_id: int
    disabled: bool = False
    title_id: str
    last_check: Optional[datetime] = Field(default_factory=utcnow)
    next_update: Optional[datetime] = None
    feed_url: Optional[str] = None
    latest_decimal: Optional[int] = None

    @classmethod
    def from_manga_service(cls, manga_service: 'MangaService'):
        return cls.model_validate(manga_service.model_dump())

    # Returns a class initializer so it is named as a class would
    # noinspection PyPep8Naming
    @property
    def Scraper(self) -> Type['BaseScraper']:
        from src.scrapers import SCRAPERS_ID
        return SCRAPERS_ID[self.service_id]

    def scrape_series(self, conn: Connection, dbutil: 'DbUtil'):
        if self.manga_id is None or self.feed_url is None:
            raise ValueError('Manga id or feed url was None')
        scraper = self.Scraper(conn, dbutil)
        return scraper.scrape_series(self.title_id, self.service_id, self.manga_id, self.feed_url)


class MangaServicePartialWithId(MangaServicePartial):
    manga_id: int


class MangaService(Manga, MangaServicePartial):

    @classmethod
    def from_partial(cls, manga_service_partial: MangaServicePartial):
        return cls.model_validate(manga_service_partial.model_dump())


class MangaServiceWithId(MangaService):
    """
    Manga service object but with guaranteed manga_id
    """
    manga_id: int

    @classmethod
    def from_manga_service(cls, manga_service: MangaService):
        return cls.model_validate(manga_service.model_dump())

    @classmethod
    def from_manga_services(cls, manga_services: Iterable[MangaService]):
        return map(cls.from_manga_service, manga_services)
