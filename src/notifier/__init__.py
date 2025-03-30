from src.enums import NotificationType
from src.notifier.base_notifier import NotifierBase
from src.notifier.discord_webhook import DiscordEmbedWebhookNotifier
from src.notifier.webhook import WebhookNotifier

NOTIFIERS: dict[NotificationType, type[NotifierBase]] = {
    NotificationType.DiscordWebhook: DiscordEmbedWebhookNotifier,
    NotificationType.Webhook:        WebhookNotifier,
}
