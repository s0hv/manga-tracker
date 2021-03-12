from src.scrapers.comixology import ComiXology
from src.scrapers.jaiminisbox import JaiminisBox
from src.scrapers.kodansha import KodanshaComics
from src.scrapers.mangadex import MangaDex
from src.scrapers.mangaplus import MangaPlus
from src.scrapers.reddit import Reddit
from src.scrapers.kireicake import KireiCake

SCRAPERS = {
    MangaDex.URL: MangaDex,
    MangaPlus.URL: MangaPlus,
    JaiminisBox.URL: JaiminisBox,
    KodanshaComics.URL: KodanshaComics,
    ComiXology.URL: ComiXology,
    Reddit.URL: Reddit,
    KireiCake.URL: KireiCake
}

SCRAPERS_ID = {
    s.ID: s for s in SCRAPERS.values()
}
