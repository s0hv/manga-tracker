import type { NotificationData } from '@/types/api/notifications';

export type FormValues<Fields> = Omit<NotificationData,
  | 'fields'
  | 'notificationType'
  | 'timesRun'
  | 'timesFailed'> & Fields & {
  _csrf: string,
}
