import json
import unittest
from datetime import datetime, timezone

import responses
from requests.models import PreparedRequest

from src.db.models.notifications import InputField, NotificationOptions
from src.notifier.base_notifier import (
    NotificationChapter,
    NotificationManga,
    NotificationMangaService,
)
from src.notifier.discord_webhook import DiscordEmbedWebhookNotifier, EmbedInputs


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
            color='#efefef'
        )

    @staticmethod
    def get_input_fields() -> list[InputField]:
        return [
            InputField(name='message', value='new chapter', optional=True),
            InputField(name='embed_title', value='$MANGA_TITLE', optional=False),
            InputField(name='username', value='test', optional=True),
            InputField(name='avatar_url', value='avatar', optional=True),
            InputField(name='embed_content', value='$TITLE - $CHAPTER_NUMBER', optional=False),
            InputField(name='url', value='$URL', optional=True),
            InputField(name='footer', value='$GROUP', optional=True),
            InputField(name='thumbnail', value='$MANGA_COVER', optional=True),
            InputField(name='color', value='#efefefef', optional=True)
        ]

    def test_embed_fields_create_with_all_fields(self):
        fields = self.get_input_fields()
        embed_inputs = EmbedInputs.from_input_list(fields)

        # Make sure all fields were set
        assert len(embed_inputs.model_dump(exclude_defaults=True, exclude_unset=True)) == len(fields)

    def test_embed_fields_create_overrides(self):
        override1 = 1
        override2 = 2
        overrideFields1 = self.get_input_fields()[:4]
        overrideFields2 = self.get_input_fields()[3:5]

        for o in overrideFields1:
            o.override_id = override1
            o.value = 'overridden'

        for o in overrideFields2:
            o.override_id = override2
            o.value = 'overridden'

        base_fields = self.get_input_fields()
        fields = [*base_fields]
        fields.extend(overrideFields1)
        fields.extend(overrideFields2)

        overrides = EmbedInputs.overrides(fields)

        assert len(overrides.keys()) == 2
        assert overrides.get(override1) is not None
        assert overrides.get(override2) is not None

        for o in overrideFields1:
            assert overrides[override1].__getattribute__(o.name) == o.value

        for o in overrideFields2:
            assert overrides[override2].__getattribute__(o.name) == o.value

        # Make sure all base fields were used
        assert len(overrides[override1].model_dump(exclude_defaults=True, exclude_unset=True)) == len(base_fields)

        assert len(overrides[override2].model_dump(exclude_defaults=True, exclude_unset=True)) == len(base_fields)

    def test_embed_fields_create_with_required_fields(self):
        fields = [
            InputField(name='embed_title', value='embed_title', optional=False),
            InputField(name='embed_content', value='embed_content', optional=False),
        ]
        embed_inputs = EmbedInputs.from_input_list(fields)

        # Make sure all fields were set
        assert len(embed_inputs.model_dump(exclude_defaults=True, exclude_unset=True)) == len(fields)

    def test_get_chapter_embed(self):
        notifier = DiscordEmbedWebhookNotifier()

        chapter = self.get_notification_chapter()
        embed_inputs = self.get_embed_inputs()

        embed = notifier.get_chapter_embed(chapter, embed_inputs, {})

        snapshot = {
            'title': 'manga',
            'description': 'title - 10.1',
            'url': 'test',
            'timestamp': '2022-03-21T19:34:42.042674+00:00',
            'color': 15724527,
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
        assert embed.__dict__ == snapshot

    def test_get_chapter_embed_with_override(self):
        notifier = DiscordEmbedWebhookNotifier()

        chapter = self.get_notification_chapter()
        embed_inputs = self.get_embed_inputs()
        override_inputs = self.get_embed_inputs()
        override_inputs.embed_title = 'overridden title'
        override_inputs.embed_content = 'overridden $MANGA_TITLE'
        overrides = {
            chapter.manga.manga_id: override_inputs
        }

        embed = notifier.get_chapter_embed(chapter, embed_inputs, overrides)

        snapshot = {
            'title': 'overridden title',
            'description': 'overridden manga',
            'url': 'test',
            'timestamp': '2022-03-21T19:34:42.042674+00:00',
            'color': 15724527,
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
        assert embed.__dict__ == snapshot

    @responses.activate
    def test_webhook_called(self):
        test_url = 'https://discord.com/webhook'
        responses.add(responses.POST, test_url,
                      body='{"id": 1234}')

        notifier = DiscordEmbedWebhookNotifier()

        chapter = self.get_notification_chapter()
        options = NotificationOptions(destination=test_url, group_by_manga=False)
        input_fields = self.get_input_fields()

        expected_calls = 1
        sent, success = notifier.send_notification([chapter], options=options, input_fields=input_fields)

        assert len(responses.calls) == expected_calls
        assert sent == expected_calls
        assert success

    @responses.activate
    def test_webhook_called_group_by_manga(self):
        test_url = 'https://discord.com/webhook'
        responses.add(responses.POST, test_url,
                      body='{"id": 1234}')

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

        assert len(responses.calls) == expected_calls
        assert sent == expected_calls
        assert success

    @responses.activate
    def test_webhook_called_with_override(self):
        test_url = 'https://discord.com/webhook'

        override_id = 1
        chapters = [
            self.get_notification_chapter(override_id),
            self.get_notification_chapter(override_id),
            self.get_notification_chapter(2),
        ]
        options = NotificationOptions(destination=test_url, group_by_manga=True)
        input_fields = self.get_input_fields()
        override_fields = [
            InputField(name='username', value='override username', optional=True, override_id=override_id),
            InputField(name='embed_content', value='description', optional=False, override_id=override_id),
        ]

        def match_override(req: PreparedRequest) -> tuple[bool, str]:
            if not isinstance(req.body, bytes):
                return False, 'Body must be bytes'

            body = json.loads(req.body.decode('utf-8'))

            # Validate override fields and some base fields
            valid = (
                body['username'] == override_fields[0].value and
                len(body['embeds']) ==  2 and
                body['embeds'][0]['description'] == override_fields[1].value and
                body['embeds'][1]['description'] == override_fields[1].value and
                body['content'] == input_fields[0].value
            )

            return valid, ''


        respOverride = responses.add(
            responses.POST, test_url, body='{"id": 1234}',
            match=[match_override]
        )
        resp = responses.add(
            responses.POST, test_url, body='{"id": 1234}',
            match=[
                responses.matchers.json_params_matcher({
                    'username': 'test'
                }, strict_match=False)
            ]
        )

        notifier = DiscordEmbedWebhookNotifier()

        expected_calls = 2
        sent, success = notifier.send_notification(chapters, options=options, input_fields=[*input_fields, *override_fields])

        assert len(responses.calls) == expected_calls
        assert sent == expected_calls
        assert success

        assert respOverride.call_count == 1
        assert resp.call_count == 1

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

        assert len(responses.calls) == expected_calls
        assert sent == expected_calls
        assert not success


if __name__ == '__main__':
    unittest.main()
