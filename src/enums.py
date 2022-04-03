import enum


class Status(enum.IntEnum):
    ONGOING = 0
    COMPLETED = 1
    DROPPED = 2
    HIATUS = 3


class NotificationType(enum.IntEnum):
    DiscordWebhook = 1
    Webhook = 2
