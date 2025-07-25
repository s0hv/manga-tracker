from typing import TYPE_CHECKING

from src.scrapers.azuki import Azuki
from src.scrapers.comick import Comick
from src.scrapers.comikey import Comikey
from src.scrapers.cubari import Cubari
from src.scrapers.mangadex import MangaDex
from src.scrapers.mangaplus import MangaPlus
from src.scrapers.reddit import Reddit

if TYPE_CHECKING:
    from src.scrapers.base_scraper import BaseScraper

SCRAPERS: dict[str, type['BaseScraper']] = {
    MangaDex.URL:  MangaDex,
    MangaPlus.URL: MangaPlus,
    Reddit.URL:    Reddit,
    Comikey.URL:   Comikey,
    Azuki.URL:     Azuki,
    Comick.URL:    Comick,
    Cubari.URL:    Cubari,
}

SCRAPERS_ID: dict[int, type['BaseScraper']] = {
    s.ID: s for s in SCRAPERS.values()
}
