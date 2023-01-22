import { handleError, handleResponse } from './utilities';
import { csrfHeader } from '../utils/csrf';
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
export const postNotifications: (csrf: string, body: any) => Promise<NotificationData> =
  (csrf, body) => fetch(`/api/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(csrf),
    },
    body: JSON.stringify(body),
  })
    .then(handleResponse<NotificationData>)
    .catch(handleError);

/**
 * Updates or creates a new notification override
 */
export const postNotificationOverride: (csrf: string, body: any) => Promise<NotificationData> =
  (csrf, body) => fetch(`/api/notifications/override`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(csrf),
    },
    body: JSON.stringify(body),
  })
    .then(handleResponse<NotificationData>)
    .catch(handleError);

/**
 * Deletes a notification
 */
export const deleteNotification: (csrf: string, notificationId: DatabaseId) => Promise<{ status: string }> =
  (csrf, notificationId) => fetch(`/api/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: {
      ...csrfHeader(csrf),
    },
  })
    .then(handleResponse<{ status: string }>)
    .catch(handleError);


export const getNotificationFollows: () => Promise<NotificationFollow[]> =
  () => fetch('/api/notifications/notificationFollows')
    .then(handleResponse<NotificationFollow[]>)
    .catch(handleError);
