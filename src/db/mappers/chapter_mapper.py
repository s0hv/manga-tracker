from typing import Optional, TYPE_CHECKING

from src.db.models.chapter import Chapter
from src.utils.utilities import remove_chapter_prefix

if TYPE_CHECKING:
    from src.scrapers.base_scraper import BaseChapter


class ChapterMapper:
    @staticmethod
    def base_chapter_to_db(base: 'BaseChapter', manga_id: Optional[int], service_id: int, strip_chapter_prefix: bool = False) -> Chapter:
        return Chapter(
            chapter_id=None,
            manga_id=manga_id,
            service_id=service_id,
            title=remove_chapter_prefix(base.title) if strip_chapter_prefix else base.title,
            chapter_number=base.chapter_number,
            chapter_decimal=base.decimal,
            release_date=base.release_date,
            chapter_identifier=base.chapter_identifier,
            group=base.group,
            group_id=base.group_id
        )
