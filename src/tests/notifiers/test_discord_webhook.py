
import unittest
from datetime import datetime, timezone
from typing import List

import responses

from src.db.models.notifications import InputField, NotificationOptions
from src.notifier.base_notifier import NotificationChapter, \
    NotificationMangaService, NotificationManga
from src.notifier.discord_webhook import DiscordEmbedWebhookNotifier, \
    EmbedInputs


class TestDiscordWebhook(unittest.TestCase):
    @staticmethod
    def get_notification_chapter(manga_id: int = 1) -> NotificationChapter:
        service = NotificationMangaService(
            name='service', url='service url', manga_url_format='', chapter_url_format=''
        )
        manga = NotificationManga(
            name='manga', service=service, cover='cover', url='manga url', manga_id=manga_id, title_id='title id'
        )

        return NotificationChapter(
            manga=manga, title='title', chapter_number='10.1',
            release_date=datetime.fromisoformat('2022-03-21T19:34:42.042674').replace(tzinfo=timezone.utc), url='test', group='group name'
        )

    @staticmethod
    def get_embed_inputs() -> EmbedInputs:
        return EmbedInputs(
            message='new chapter',
            embed_title='$MANGA_TITLE',
            username='test',
            avatar_url='avatar',
            embed_content='$TITLE - $CHAPTER_NUMBER',
            url='$URL',
            footer='$GROUP',
            thumbnail='$MANGA_COVER',
            color=155
        )

    @staticmethod
    def get_input_fields() -> List[InputField]:
        return [
            InputField(name='message', value='new chapter', optional=True),
            InputField(name='embed_title', value='$MANGA_TITLE', optional=False),
            InputField(name='username', value='test', optional=True),
            InputField(name='avatar_url', value='avatar', optional=True),
            InputField(name='embed_content', value='$TITLE - $CHAPTER_NUMBER', optional=False),
            InputField(name='url', value='$URL', optional=True),
            InputField(name='footer', value='$GROUP', optional=True),
            InputField(name='thumbnail', value='$MANGA_COVER', optional=True),
            InputField(name='color', value='155', optional=True)
        ]

    def test_embed_fields_create_with_all_fields(self):
        fields = self.get_input_fields()
        embed_inputs = EmbedInputs.from_input_list(fields)

        # Make sure all fields were set
        self.assertEqual(
            len(embed_inputs.dict(exclude_defaults=True, exclude_unset=True)),
            len(fields)
        )

    def test_embed_fields_create_with_required_fields(self):
        fields = [
            InputField(name='embed_title', value='embed_title', optional=False),
            InputField(name='embed_content', value='embed_content', optional=False),
        ]
        embed_inputs = EmbedInputs.from_input_list(fields)

        # Make sure all fields were set
        self.assertEqual(
            len(embed_inputs.dict(exclude_defaults=True, exclude_unset=True)),
            len(fields)
        )

    def test_get_chapter_embed(self):
        notifier = DiscordEmbedWebhookNotifier()

        chapter = self.get_notification_chapter()
        embed_inputs = self.get_embed_inputs()

        embed = notifier.get_chapter_embed(chapter, embed_inputs)

        snapshot = {
            'title': 'manga',
            'description': 'title - 10.1',
            'url': 'test',
            'timestamp': '2022-03-21T19:34:42.042674+00:00',
            'color': 155,
            'footer': {
                'text': 'group name',
                'icon_url': None,
                'proxy_icon_url': None
            },
            'image': None,
            'thumbnail': {
                'url': 'cover',
                'proxy_url': None,
                'height': None,
                'width': None
            },
            'video': None,
            'provider': None,
            'author': None,
            'fields': []
        }

        # The webhook lib uses __dict__ internally to serialize embed objects
        self.assertDictEqual(embed.__dict__, snapshot)

    @responses.activate
    def test_webhook_called(self):
        test_url = 'https://discord.com/webhook'
        responses.add(responses.POST, test_url,
                      body='OK')

        notifier = DiscordEmbedWebhookNotifier()

        chapter = self.get_notification_chapter()
        options = NotificationOptions(destination=test_url, group_by_manga=False)
        input_fields = self.get_input_fields()

        expected_calls = 1
        sent, success = notifier.send_notification([chapter], options=options, input_fields=input_fields)

        self.assertEqual(len(responses.calls), expected_calls)
        self.assertEqual(sent, expected_calls)
        self.assertTrue(success)

    @responses.activate
    def test_webhook_called_group_by_manga(self):
        test_url = 'https://discord.com/webhook'
        responses.add(responses.POST, test_url,
                      body='OK')

        notifier = DiscordEmbedWebhookNotifier()

        chapters = [
            self.get_notification_chapter(),
            self.get_notification_chapter(),
            self.get_notification_chapter(2),
            self.get_notification_chapter(3)
        ]
        options = NotificationOptions(destination=test_url, group_by_manga=True)
        input_fields = self.get_input_fields()

        expected_calls = 3
        sent, success = notifier.send_notification(chapters, options=options, input_fields=input_fields)

        self.assertEqual(len(responses.calls), expected_calls)
        self.assertEqual(sent, expected_calls)
        self.assertTrue(success)

    @responses.activate
    def test_webhook_called_with_error(self):
        test_url = 'https://discord.com/webhook'
        responses.add(responses.POST, test_url,
                      status=400)

        notifier = DiscordEmbedWebhookNotifier()

        chapters = [
            self.get_notification_chapter(),
            self.get_notification_chapter(),
            self.get_notification_chapter(2),
            self.get_notification_chapter(3)
        ]
        options = NotificationOptions(destination=test_url, group_by_manga=True)
        input_fields = self.get_input_fields()

        expected_calls = 1
        sent, success = notifier.send_notification(chapters, options=options,
                                                   input_fields=input_fields)

        self.assertEqual(len(responses.calls), expected_calls)
        self.assertEqual(sent, expected_calls)
        self.assertFalse(success)


if __name__ == '__main__':
    unittest.main()
