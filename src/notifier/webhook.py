import json
import logging

import requests
from pydantic import Field

from src.db.models.notifications import InputField, NotificationOptions
from src.notifier.base_notifier import BaseEmbedInputs, NotificationChapter, NotifierBase

logger = logging.getLogger('debug')


class EmbedInputs(BaseEmbedInputs):
    json_field: str = Field(..., alias='json')


class JsonFields:
    CHAPTER_FORMAT = '$CHAPTER_FORMAT'
    CHAPTER_ARRAY = '$CHAPTER_ARRAY'


class WebhookNotifier(NotifierBase):
    MAX_DEPTH = 5

    def format_dict(self, d: dict, chapter: NotificationChapter, depth: int = 0) -> dict:
        """
        Recursively formats all strings in the dict with the given chapter
        """
        if depth > self.MAX_DEPTH:
            raise ValueError('Dict recursion exceeded max depth')

        d = d.copy()

        for key, value in d.items():
            if isinstance(value, str):
                d[key] = self.format_string(value, chapter)
            elif isinstance(value, dict):
                d[key] = self.format_dict(value, chapter, depth=depth+1)

        return d

    @staticmethod
    def validate_json(json_string: str) -> dict:
        try:
            data = json.loads(json_string)
        except Exception:
            logger.error('Failed to parse json')
            raise

        if not isinstance(data.get(JsonFields.CHAPTER_ARRAY), str):
            msg = 'CHAPTER_ARRAY not a string'
            logger.error(msg)
            raise ValueError(msg)

        if not isinstance(data.get(JsonFields.CHAPTER_FORMAT), dict):
            msg = 'CHAPTER_FORMAT not an object'
            logger.error(msg)
            raise ValueError(msg)

        return data

    def send_notification(self, chapters: list[NotificationChapter], options: NotificationOptions, input_fields: list[InputField]) -> tuple[int, bool]:
        inputs = EmbedInputs.from_input_list(input_fields)

        data = self.validate_json(inputs.json_field)
        times_executed = 0

        groups = self.get_chapters_grouped(chapters, options)

        chapter_format: dict = data.pop(JsonFields.CHAPTER_FORMAT)
        chapters_array_key = data.pop(JsonFields.CHAPTER_ARRAY)

        for group in groups:
            group_sorted = self.sort_chapters(group)

            chapters_array = [self.format_dict(chapter_format, chapter) for chapter in group_sorted]
            data[chapters_array_key] = chapters_array

            try:
                r = requests.post(options.destination, json=data)
                times_executed += 1
                if not r.ok:
                    return times_executed, False
            except Exception:
                logger.exception('Failed to send webhook')
                return times_executed, False

        return times_executed, True
