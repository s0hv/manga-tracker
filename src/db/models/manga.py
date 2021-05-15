from datetime import timedelta, datetime
from typing import Optional, Type, TYPE_CHECKING

from psycopg2.extensions import connection as Connection
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from src.scrapers.base_scraper import BaseScraper
    from src.utils.dbutils import DbUtil


class Manga(BaseModel):
    manga_id: Optional[int]
    title: str
    release_interval: Optional[timedelta] = None
    latest_release: Optional[datetime] = None
    estimated_release: Optional[datetime] = None
    latest_chapter: Optional[int] = None
    views: int = 0


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
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class MangaServicePartial(BaseModel):
    manga_id: Optional[int]
    service_id: int
    disabled: bool = False
    title_id: str
    last_check: Optional[datetime] = Field(default_factory=datetime.utcnow)
    next_update: Optional[datetime] = None
    feed_url: Optional[str] = None
    latest_decimal: Optional[int] = None

    # Returns a class initializer so it is named as a class would
    # noinspection PyPep8Naming
    @property
    def Scraper(self) -> Type['BaseScraper']:
        from src.scrapers import SCRAPERS_ID
        return SCRAPERS_ID[self.service_id]

    def scrape_series(self, conn: Connection, dbutil: 'DbUtil'):
        if self.manga_id is None:
            raise ValueError('Manga id was None')
        scraper = self.Scraper(conn, dbutil)
        return scraper.scrape_series(self.title_id, self.service_id, self.manga_id, self.feed_url)


class MangaService(Manga, MangaServicePartial):
    pass


class MangaServiceWithId(MangaService):
    """
    Manga service object but with guaranteed manga_id
    """
    manga_id: int
