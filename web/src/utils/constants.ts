export const NotificationTypes = {
  DiscordWebhook: 1,
  Webhook: 2,
} as const;
export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];

export const noRows: never[] = [];
