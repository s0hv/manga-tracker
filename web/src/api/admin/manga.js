import { handleResponse, handleError } from '../utilities';
import { csrfHeader } from '../../utils/csrf';

export const getScheduledRuns = (mangaId) => fetch(`/api/admin/manga/${mangaId}/scheduledRuns`)
  .then(handleResponse)
  .catch(handleError);

export const createScheduledRun = (csrf, mangaId, serviceId) => fetch(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`,
  {
    method: 'POST',
    headers: csrfHeader(csrf),
  })
  .then(handleResponse)
  .catch(handleError);

export const deleteScheduledRun = (csrf, mangaId, serviceId) => fetch(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`,
  {
    method: 'DELETE',
    headers: csrfHeader(csrf),
  })
  .then(handleResponse)
  .catch(handleError);

/**
 * Updates the title of a manga
 * @param {string} csrf CSRF token
 * @param {Number|string} mangaId Id of the manga
 * @param {string} title New title of the manga
 */
export const updateMangaTitle = (csrf, mangaId, title) => fetch(`/api/admin/manga/${mangaId}/title`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(csrf),
    },
    body: JSON.stringify({ title }),
  })
  .then(handleResponse)
  .catch(handleError);
