import { mutationOptions, queryOptions } from '@tanstack/react-query';

import type {
  NotificationData,
  NotificationFollow,
} from '@/types/api/notifications';
import type { DatabaseId } from '@/types/dbTypes';

import { handleError, handleResponse } from './utilities';

export const notificationsUrls = {
  notifications: '/api/notifications',
  override: '/api/notifications/override',
  notification: (notificationId: DatabaseId) => `/api/notifications/${notificationId}`,
  notificationFollows: '/api/notifications/notificationFollows',
} as const;

export const notificationsQueryKey = [notificationsUrls.notifications] as const;

/**
 * Fetches user notifications
 */
export const getNotifications: () => Promise<NotificationData[]> =
  () => fetch(notificationsUrls.notifications)
    .then(handleResponse<NotificationData[]>)
    .catch(handleError);

export const getNotificationsQueryOptions = queryOptions({
  queryKey: notificationsQueryKey,
  queryFn: getNotifications,
});

/**
 * Updates or creates a new notification
 */
export const postNotifications: (body: any) => Promise<NotificationData> =
  body => fetch(notificationsUrls.notifications, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
    .then(handleResponse<NotificationData>)
    .catch(handleError);

export const postNotificationsMutationOptions = mutationOptions({
  mutationFn: postNotifications,
});

/**
 * Updates or creates a new notification override
 */
export const postNotificationOverride: (body: any) => Promise<NotificationData> =
  body => fetch(notificationsUrls.override, {
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
  notificationId => fetch(notificationsUrls.notification(notificationId), {
    method: 'DELETE',
  })
    .then(handleResponse<{ status: string }>)
    .catch(handleError);

export const deleteNotificationMutationOptions = mutationOptions({
  mutationFn: deleteNotification,
  meta: {
    queryKeysToInvalidate: [notificationsQueryKey],
    invalidateOnError: true,
  },
});


export const getNotificationFollows: () => Promise<NotificationFollow[]> =
  () => fetch(notificationsUrls.notificationFollows)
    .then(handleResponse<NotificationFollow[]>)
    .catch(handleError);

export const notificationFollowsQueryKey = [notificationsUrls.notificationFollows] as const;

export const getNotificationFollowsQueryOptions = queryOptions({
  queryKey: notificationFollowsQueryKey,
  queryFn: getNotificationFollows,
  placeholderData: () => [],
  staleTime: 1000 * 30,
});
