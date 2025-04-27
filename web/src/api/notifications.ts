import { handleError, handleResponse } from './utilities';
import type { DatabaseId } from '@/types/dbTypes';
import type {
  NotificationData,
  NotificationFollow,
} from '@/types/api/notifications';

/**
 * Fetches user notifications
 */
export const getNotifications: () => Promise<NotificationData[]> =
  () => fetch(`/api/notifications`)
    .then(handleResponse<NotificationData[]>)
    .catch(handleError);

/**
 * Updates or creates a new notification
 */
export const postNotifications: (body: any) => Promise<NotificationData> =
  (body) => fetch(`/api/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
    .then(handleResponse<NotificationData>)
    .catch(handleError);

/**
 * Updates or creates a new notification override
 */
export const postNotificationOverride: (body: any) => Promise<NotificationData> =
  (body) => fetch(`/api/notifications/override`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
    .then(handleResponse<NotificationData>)
    .catch(handleError);

/**
 * Deletes a notification
 */
export const deleteNotification: (notificationId: DatabaseId) => Promise<{ status: string }> =
  (notificationId) => fetch(`/api/notifications/${notificationId}`, {
    method: 'DELETE',
  })
    .then(handleResponse<{ status: string }>)
    .catch(handleError);


export const getNotificationFollows: () => Promise<NotificationFollow[]> =
  () => fetch('/api/notifications/notificationFollows')
    .then(handleResponse<NotificationFollow[]>)
    .catch(handleError);
