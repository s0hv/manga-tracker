from typing import Dict, Type

from src.enums import NotificationType
from src.notifier.base_notifier import NotifierBase
from src.notifier.webhook import DiscordEmbedWebhookNotifier

NOTIFIERS: Dict[NotificationType, Type[NotifierBase]] = {
    NotificationType.DiscordWebhook: DiscordEmbedWebhookNotifier
}
