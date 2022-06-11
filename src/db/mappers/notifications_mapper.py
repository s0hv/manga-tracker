from typing import List, Dict, Tuple

from src.db.models.chapter import Chapter
from src.db.models.manga import MangaForNotifications
from src.db.models.services import Service
from src.notifier.base_notifier import NotificationChapter, NotificationManga, \
    NotificationMangaService


class NotificationsMapper:
    @staticmethod
    def chapter_to_notification(
            chapters: List[Chapter],
            services: Dict[int, Service],
            manga: List[MangaForNotifications]
    ) -> List[NotificationChapter]:
        mapped: List[NotificationChapter] = []
        mapped_services = NotificationsMapper.services_to_notification(services)
        mapped_manga: Dict[Tuple[int, int], NotificationManga] = {
            (m.manga_id, m.service_id): NotificationsMapper.manga_to_notification(m, mapped_services)
            for m in manga
        }

        for chapter in chapters:
            found_manga = mapped_manga[chapter.manga_id, chapter.service_id]
            mapped.append(NotificationChapter(
                manga=found_manga,
                title=chapter.title,
                chapter_number=chapter.full_chapter_number(),
                release_date=chapter.release_date,
                url=found_manga.service.chapter_url_format.format(chapter.chapter_identifier, title_id=found_manga.title_id),
                group=chapter.group or found_manga.service.name
            ))

        return mapped

    @staticmethod
    def services_to_notification(services: Dict[int, Service]) -> Dict[int, NotificationMangaService]:
        mapped: Dict[int, NotificationMangaService] = {}

        for service in services.values():
            mapped[service.service_id] = NotificationMangaService(
                name=service.service_name,
                url=service.url,
                manga_url_format=service.manga_url_format,
                chapter_url_format=service.chapter_url_format
            )

        return mapped

    @staticmethod
    def manga_to_notification(manga: MangaForNotifications, services: Dict[int, NotificationMangaService]) -> NotificationManga:
        service = services[manga.service_id]
        return NotificationManga(
            name=manga.title,
            service=service,
            url=service.manga_url_format.format(manga.title_id),
            manga_id=manga.manga_id,
            cover=manga.cover,
            title_id=manga.title_id
        )
