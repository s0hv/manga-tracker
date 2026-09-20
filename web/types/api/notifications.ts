import type { NotificationFollowRow } from '@/db/schemas/notifications';

export type NotificationFieldData = {
  name: string;
  value: string | null;
};

export type NotificationFollow = NotificationFollowRow;


export type NotificationManga = NotificationFollow;


export type NotificationField = NotificationFieldData & {
  optional: boolean;
};

export type NotificationData = {
  notificationId: number;
  useFollows: boolean | null;
  notificationType: number;
  timesRun: number | null;
  timesFailed: number | null;
  disabled: boolean;
  groupByManga: boolean;
  destination: string;
  name: string;
  manga: NotificationManga[] | null;
  fields: NotificationField[];
  overrides: Record<number | string, NotificationField[]>;
};
