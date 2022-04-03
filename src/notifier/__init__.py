from typing import Dict, Type

from src.enums import NotificationType
from src.notifier.base_notifier import NotifierBase
from src.notifier.discord_webhook import DiscordEmbedWebhookNotifier
from src.notifier.webhook import WebhookNotifier

NOTIFIERS: Dict[NotificationType, Type[NotifierBase]] = {
    NotificationType.DiscordWebhook: DiscordEmbedWebhookNotifier,
    NotificationType.Webhook: WebhookNotifier
}
