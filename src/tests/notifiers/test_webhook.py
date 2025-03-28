import json
import unittest
from datetime import datetime, timezone
from typing import List

import pytest
import responses
from responses import matchers

from src.db.models.notifications import InputField, NotificationOptions
from src.notifier.base_notifier import (NotificationChapter, NotificationManga,
                                        NotificationMangaService)
from src.notifier.webhook import JsonFields, WebhookNotifier


class TestWebhook(unittest.TestCase):
    test_json: str = """{
        "$CHAPTER_ARRAY": "chapters",
        "$CHAPTER_FORMAT": {
            "title": "$TITLE",
            "manga": "$MANGA_TITLE",
            "chapterNumber": "$CHAPTER_NUMBER"
        }
    }"""

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
    def get_input_fields() -> List[InputField]:
        return [
            InputField(name='json', value=TestWebhook.test_json, optional=False)
        ]

    def create_matcher(self, chapters: List[NotificationChapter], chapters_key: str = 'chapters') -> object:
        return matchers.json_params_matcher({
            chapters_key: list(map(lambda c: WebhookNotifier().format_dict(
                    WebhookNotifier.validate_json(self.test_json)[JsonFields.CHAPTER_FORMAT],
                    c
                ), chapters))

          })

    def test_validate_json(self):
        notifier = WebhookNotifier()

        js = """{
          "$CHAPTER_ARRAY": "test",
          "$CHAPTER_FORMAT": {},
          "customData": 10
        }"""

        data = notifier.validate_json(js)

        self.assertDictEqual(json.loads(js), data)

    def test_validate_json_without_array(self):
        notifier = WebhookNotifier()

        with pytest.raises(ValueError):
            notifier.validate_json("""{
              "$CHAPTER_FORMAT": {}
            }""")

        with pytest.raises(ValueError):
            notifier.validate_json("""{
              "$CHAPTER_ARRAY": 1,
              "$CHAPTER_FORMAT": {}
            }""")

    def test_validate_json_without_format(self):
        notifier = WebhookNotifier()

        with pytest.raises(ValueError):
            notifier.validate_json("""{
              "$CHAPTER_ARRAY": "a"
            }""")

        with pytest.raises(ValueError):
            notifier.validate_json("""{
              "$CHAPTER_ARRAY": "a",
              "$CHAPTER_FORMAT": "test"
            }""")

    def test_validate_json_with_invalid_json(self):
        notifier = WebhookNotifier()

        with pytest.raises(json.JSONDecodeError):
            notifier.validate_json("""{
              "$CHAPTER_ARRAY": "a"
            """)

    def test_format_dict(self):
        notifier = WebhookNotifier()

        c = self.get_notification_chapter()
        d = {
            "title": "$TITLE",
            "inner": {
                "ch": "$CHAPTER_NUMBER"
            }
        }
        expected = {
            "title": c.title,
            "inner": {
                "ch": c.chapter_number
            }
        }
        d = notifier.format_dict(d, c)

        self.assertDictEqual(d, expected)

    def test_format_dict_max_recursion_throws(self):
        notifier = WebhookNotifier()

        c = self.get_notification_chapter()
        d: dict = {"test": "a"}
        d["recursion"] = d

        with pytest.raises(ValueError, match='Dict recursion exceeded max depth'):
            notifier.format_dict(d, c)

    @responses.activate
    def test_webhook_called(self):
        notifier = WebhookNotifier()
        chapter = self.get_notification_chapter()
        chapter2 = self.get_notification_chapter(2)

        chapters = [chapter, chapter2]

        test_url = 'https://localhost:3000'
        responses.add(responses.POST, test_url,
                      body='OK',
                      match=[self.create_matcher(chapters)]
                      )

        options = NotificationOptions(destination=test_url, group_by_manga=False)
        input_fields = self.get_input_fields()

        expected_calls = 1
        sent, success = notifier.send_notification(chapters, options=options, input_fields=input_fields)

        self.assertEqual(len(responses.calls), expected_calls)
        self.assertEqual(sent, expected_calls)
        self.assertTrue(success)

    @responses.activate
    def test_webhook_called_group_by_manga(self):
        test_url = 'https://localhost:3000'
        responses.add(responses.POST, test_url,
                      body='OK')

        notifier = WebhookNotifier()

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
        test_url = 'https://localhost:3000'
        responses.add(responses.POST, test_url,
                      status=400)

        notifier = WebhookNotifier()

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
