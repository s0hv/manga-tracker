
import unittest
from unittest.mock import MagicMock, patch

from src.db.mappers.notifications_mapper import NotificationsMapper
from src.db.models.chapter import Chapter
from src.db.models.manga import MangaForNotifications
from src.db.models.services import Service
from src.notifier.base_notifier import NotificationManga, NotificationMangaService
from src.utils.utilities import utcnow


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
        assert len(mapped) == 1

        mapped_service = mapped[service.service_id]
        assert mapped_service.name == service.service_name
        assert mapped_service.url == service.url
        assert mapped_service.manga_url_format == service.manga_url_format
        assert mapped_service.chapter_url_format == service.chapter_url_format

    def test_map_manga_to_notification(self):
        service = self.get_service()
        service_id = 1

        manga = MangaForNotifications(
            manga_id=1, title='title', cover='cover', title_id='title_id', service_id=service_id
        )
        mapped = NotificationsMapper.manga_to_notification(manga, {service_id: service})

        assert mapped.name == manga.title
        assert mapped.url == service.manga_url_format.format(manga.title_id)
        assert mapped.service == service
        assert mapped.manga_id == manga.manga_id
        assert mapped.cover == manga.cover

    @patch.object(NotificationsMapper, 'manga_to_notification')
    @patch.object(NotificationsMapper, 'services_to_notification')
    def test_map_chapters_to_notification(self, mock_services: MagicMock, mock_manga: MagicMock):
        service = self.get_service()
        service_id = 1
        manga_id = 2
        chapter_id = 3
        title_id = 'title_id'

        mock_services.return_value = {service_id: service}
        mock_manga.return_value = NotificationManga(
            name='manga',
            service=service,
            cover='cover',
            url='url',
            manga_id=manga_id,
            title_id=title_id
        )

        chapter = Chapter(
            chapter_id=chapter_id,
            manga_id=manga_id,
            service_id=service_id,
            title='title',
            chapter_number=1,
            chapter_decimal=5,
            release_date=utcnow(),
            chapter_identifier='ch_id',
            group='group',
            group_id=1)
        mapped_chapters = NotificationsMapper.chapter_to_notification(
            [chapter],
            {},
            [MangaForNotifications(manga_id=manga_id, title='', title_id='', service_id=service_id)]
        )

        assert len(mapped_chapters) == 1

        assert mock_manga.call_count == 1
        assert mock_services.call_count == 1

        mapped = mapped_chapters[0]
        assert mapped.url == service.chapter_url_format.format(chapter.chapter_identifier, title_id=title_id)
        assert mapped.manga == mock_manga.return_value
        assert mapped.title == chapter.title
        assert mapped.group == chapter.group
        assert mapped.release_date == chapter.release_date


if __name__ == '__main__':
    unittest.main()
