import logging
from typing import List, Optional, Tuple

from discord_webhook import DiscordWebhook, DiscordEmbed

from src.db.models.notifications import InputField, NotificationOptions
from src.db.types import ColorInt
from src.notifier.base_notifier import (
    NotifierBase, NotificationChapter, BaseEmbedInputs
)

logger = logging.getLogger('debug')


class EmbedInputs(BaseEmbedInputs):
    message: Optional[str]
    embed_title: str
    username: Optional[str]
    avatar_url: Optional[str]
    embed_content: str
    url: Optional[str]
    footer: Optional[str]
    thumbnail: Optional[str]
    color: Optional[ColorInt]


class WebhookLimits:
    EMBEDS = 10
    TITLE = 256
    USERNAME = 80


class DiscordEmbedWebhookNotifier(NotifierBase):
    def get_chapter_embed(self, chapter: NotificationChapter, embed_inputs: EmbedInputs) -> DiscordEmbed:
        embed = DiscordEmbed(
            title=self.format_string(embed_inputs.embed_title, chapter)[:WebhookLimits.TITLE],
            description=self.format_string(embed_inputs.embed_content, chapter),
            color=embed_inputs.color,
            url=self.format_string(embed_inputs.url, chapter),
            timestamp=chapter.release_date.isoformat()
        )

        if embed_inputs.footer is not None:
            embed.set_footer(
                text=self.format_string(embed_inputs.footer, chapter)
            )

        if embed_inputs.thumbnail is not None:
            embed.set_thumbnail(
                url=self.format_string(embed_inputs.thumbnail, chapter)
            )

        return embed

    def send_notification(self, chapters: List[NotificationChapter], options: NotificationOptions, input_fields: List[InputField]) -> Tuple[int, bool]:
        groups = self.get_chapters_grouped(chapters, options)

        embed_inputs = EmbedInputs.from_input_list(input_fields)
        times_executed = 0

        for group in groups:
            group_sorted = self.sort_chapters(group)

            embeds = list(map(lambda c: self.get_chapter_embed(c, embed_inputs), group_sorted))

            if embed_inputs.username:
                username = self.format_title(embed_inputs.username, group)[:WebhookLimits.USERNAME]
            else:
                username = None

            message = None
            if embed_inputs.message:
                message = self.format_title(embed_inputs.message, group)

            def get_webhook() -> DiscordWebhook:
                return DiscordWebhook(
                    url=options.destination,
                    username=username,
                    avatar_url=embed_inputs.avatar_url,
                    timeout=10
                )

            for i in range(0, len(embeds), WebhookLimits.EMBEDS):
                chunk = embeds[i:i+WebhookLimits.EMBEDS]
                webhook = get_webhook()
                list(map(webhook.add_embed, chunk))
                webhook.content = message
                try:
                    times_executed += 1
                    response = webhook.execute()
                    if not response or not response.ok:
                        return times_executed, False
                except:
                    logger.exception('Failed to send webhook')
                    return times_executed, False

        return times_executed, True
