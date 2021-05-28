import { handleResponse, handleError } from './utilities';
import { csrfHeader } from '../utils/csrf';
import { snakeCase } from '../../utils/utilities';

/**
 * Fetches chapters for a manga
 * @param {Number|string} mangaId id of the manga to fetch chapters for
 * @param {Number|string} limit limit of the fetched chapters
 * @param {Number|string} offset current offset
 * @param {Object[]} sortBy A list of objects containing the row name and sorting directions
 */
export const getChapters =
  (mangaId, limit, offset, sortBy) => {
    const orderBy = sortBy.length > 0 ?
      `&sortBy=${snakeCase(sortBy[0].id)}&sort=${sortBy[0].desc ? 'desc' : 'asc'}` : '';
    return fetch(`/api/manga/${mangaId}/chapters?limit=${limit}&offset=${offset}${orderBy}`)
      .then(handleResponse)
      .catch(handleError);
  };

/**
 * Updates a chapter with the given data
 * @param {string} csrf CSRF token
 * @param {Number|string} chapterId Id of the chapter to be updated
 * @param {object} data Update data
 */
export const updateChapter = (csrf, chapterId, data) => fetch(`/api/chapter/${chapterId}`,
  {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(csrf),
    },
    body: JSON.stringify(data),
  })
  .then(handleResponse)
  .catch(handleError);

/**
 * Deletes a chapter with the given id
 * @param {string} csrf CSRF token
 * @param {Number|string} chapterId Id of the chapter to delete
 */
export const deleteChapter = (csrf, chapterId) => fetch(`/api/chapter/${chapterId}`,
  {
    method: 'delete',
    headers: csrfHeader(csrf),
  })
  .then(handleResponse)
  .catch(handleError);

/**
 * Gets the chapter releases for a manga
 * @param {Number|string} mangaId Id of the manga to get releases for
 * @return {Promise<any>}
 */
export const getMangaReleases = (mangaId) => fetch(`/api/chapter/releases/${mangaId}`)
  .then(handleResponse)
  .catch(handleError);
