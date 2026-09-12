import type { NotificationData } from '@/types/api/notifications';

export interface FormValues extends Omit<NotificationData,
  | 'fields'
  | 'overrides'
  | 'notificationType'
  | 'timesRun'
  | 'timesFailed'> {
  overrideId: number | null;
}

export interface NotificationComponentProps {
  notificationData: NotificationData;
  defaultExpanded?: boolean;
}
