import type { NotificationData } from '@/types/api/notifications';

export type FormValues<Fields> = Omit<NotificationData,
  | 'fields'
  | 'overrides'
  | 'notificationType'
  | 'timesRun'
  | 'timesFailed'> & Fields & {
  _csrf: string,
  overrideId: number | null
}
