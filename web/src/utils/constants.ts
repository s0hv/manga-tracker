export const NotificationTypes = {
  DiscordWebhook: 1,
  Webhook: 2,
} as const;
export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];

export const QueryKeys = {
  NotificationsList: ['notifications-list'],
  MangaServices: 'admin-manga-service',
  Services: ['services'],
  NotificationFollows: ['notification-follows'],
  LatestChapters: 'latest-chapters',
} as const;
