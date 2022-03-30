import { handleResponse, handleError } from './utilities';
import { csrfHeader } from '../utils/csrf';

/**
 * Fetches user notifications
 * @return {Promise<any>}
 */
export const getNotifications = () => fetch(`/api/notifications`)
  .then(handleResponse)
  .catch(handleError);

/**
 * Updates or creates a new notification
 * @return {Promise<any>}
 */
export const postNotifications = (csrf, body) => fetch(`/api/notifications`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...csrfHeader(csrf),
  },
  body: JSON.stringify(body),
})
  .then(handleResponse)
  .catch(handleError);

/**
 * Deletes a notification
 * @return {Promise<any>}
 */
export const deleteNotification = (csrf, notificationId) => fetch(`/api/notifications/${notificationId}`, {
  method: 'DELETE',
  headers: {
    ...csrfHeader(csrf),
  },
})
  .then(handleResponse)
  .catch(handleError);
