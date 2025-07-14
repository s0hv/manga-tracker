import { NotificationData } from '@/types/api/notifications';
import { type NotificationType, NotificationTypes } from '@/webUtils/constants';

export const defaultDataForType = {
  [NotificationTypes.DiscordWebhook]: {
    useFollows: false,
    notificationType: NotificationTypes.DiscordWebhook,
    disabled: false,
    groupByManga: true,
    manga: null,
    overrides: {},
    fields: [
      {
        value: '$MANGA_TITLE - Chapter $CHAPTER_NUMBER',
        name: 'embed_title',
        optional: false,
      },
      {
        value: '$TITLE\n$URL\nby $GROUP',
        name: 'embed_content',
        optional: false,
      },
      {
        value: '$GROUP',
        name: 'footer',
        optional: true,
      },
      {
        value: '$MANGA_COVER',
        name: 'thumbnail',
        optional: true,
      },
      {
        value: '$MANGA_TITLES',
        name: 'username',
        optional: true,
      },
      {
        value: '$URL',
        name: 'url',
        optional: true,
      },
    ],
  },
  [NotificationTypes.Webhook]: {
    notificationType: NotificationTypes.Webhook,
    fields: [
      { name: 'json',
        value: `{
  "$CHAPTER_ARRAY": "key name that will contain chapters",
  "$CHAPTER_FORMAT": {}
}`,
        optional: false,
      },
    ],
  },
} as const satisfies Record<NotificationType, Partial<NotificationData>>;
