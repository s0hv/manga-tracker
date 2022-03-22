
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from src.db.mappers.notifications_mapper import NotificationsMapper
from src.db.models.chapter import Chapter
from src.db.models.manga import MangaForNotifications
from src.db.models.services import Service
from src.notifier.base_notifier import NotificationMangaService, \
    NotificationManga


class TestUtilities(unittest.TestCase):
    @staticmethod
    def get_service() -> NotificationMangaService:
        return NotificationMangaService(
            name='service', url='service url',
            manga_url_format='manga_url_format/{}', chapter_url_format='chapter_url_format/{}'
        )

    def test_map_services_to_notification(self):
        service = Service(
            service_id=1,
            service_name='service',
            url='service url',
            manga_url_format='manga_url_format/{}',
            chapter_url_format='chapter_url_format/{}'
        )
        mapped = NotificationsMapper.services_to_notification({service.service_id: service})
        self.assertEqual(len(mapped), 1)

        mapped_service = mapped[service.service_id]
        self.assertEqual(mapped_service.name, service.service_name)
        self.assertEqual(mapped_service.url, service.url)
        self.assertEqual(mapped_service.manga_url_format, service.manga_url_format)
        self.assertEqual(mapped_service.chapter_url_format, service.chapter_url_format)

    def test_map_manga_to_notification(self):
        service = self.get_service()
        service_id = 1

        manga = MangaForNotifications(
            manga_id=1, title='title', cover='cover', title_id='title_id', service_id=service_id
        )
        mapped = NotificationsMapper.manga_to_notification(manga, {service_id: service})

        self.assertEqual(mapped.name, manga.title)
        self.assertEqual(mapped.url, service.manga_url_format.format(manga.title_id))
        self.assertEqual(mapped.service, service)
        self.assertEqual(mapped.manga_id,  manga.manga_id)
        self.assertEqual(mapped.cover,  manga.cover)

    @patch.object(NotificationsMapper, 'manga_to_notification')
    @patch.object(NotificationsMapper, 'services_to_notification')
    def test_map_chapters_to_notification(self, mock_services: MagicMock, mock_manga: MagicMock):
        service = self.get_service()
        service_id = 1
        manga_id = 2
        chapter_id = 3

        mock_services.return_value = {service_id: service}
        mock_manga.return_value = NotificationManga(
            name='manga',
            service=service,
            cover='cover',
            url='url',
            manga_id=manga_id
        )

        chapter = Chapter(
            chapter_id=chapter_id,
            manga_id=manga_id,
            service_id=service_id,
            title='title',
            chapter_number=1,
            chapter_decimal=5,
            release_date=datetime.utcnow(),
            chapter_identifier='ch_id',
            group='group',
            group_id=1)
        mapped_chapters = NotificationsMapper.chapter_to_notification(
            [chapter],
            {},
            [MangaForNotifications(manga_id=manga_id, title='', title_id='', service_id=service_id)]
        )

        self.assertEqual(len(mapped_chapters), 1)

        self.assertEqual(mock_manga.call_count, 1)
        self.assertEqual(mock_services.call_count, 1)

        mapped = mapped_chapters[0]
        self.assertEqual(mapped.url, service.chapter_url_format.format(chapter.chapter_identifier))
        self.assertEqual(mapped.manga, mock_manga.return_value)
        self.assertEqual(mapped.title, chapter.title)
        self.assertEqual(mapped.group, chapter.group)
        self.assertEqual(mapped.release_date, chapter.release_date)


if __name__ == '__main__':
    unittest.main()
