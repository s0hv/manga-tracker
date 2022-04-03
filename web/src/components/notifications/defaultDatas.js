import { NotificationTypes } from '../../utils/constants';

export const defaultDataForType = {
  [NotificationTypes.DiscordWebhook]: {
    useFollows: false,
    notificationType: NotificationTypes.DiscordWebhook,
    disabled: false,
    groupByManga: false,
    manga: null,
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
      { name: 'json', value: `{
  "$CHAPTER_ARRAY": "key",
  "$CHAPTER_FORMAT": {}
}`,
      },
    ],
  },
};
