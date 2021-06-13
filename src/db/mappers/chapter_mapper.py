from typing import Optional, TYPE_CHECKING

from src.db.models.chapter import Chapter

if TYPE_CHECKING:
    from src.scrapers.base_scraper import BaseChapter


class ChapterMapper:
    @staticmethod
    def base_chapter_to_db(base: 'BaseChapter', manga_id: Optional[int], service_id: int) -> Chapter:
        return Chapter(
            chapter_id=None,
            manga_id=manga_id,
            service_id=service_id,
            title=base.title,
            chapter_number=base.chapter_number,
            chapter_decimal=base.decimal,
            release_date=base.release_date,
            chapter_identifier=base.chapter_identifier,
            group=base.group,
            group_id=base.group_id
        )
