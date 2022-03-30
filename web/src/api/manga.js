import { handleResponse, handleError } from './utilities';
import { csrfHeader } from '../utils/csrf';

/**
 * Get a manga from the api by id
 * @param {Number|string} mangaId Id of the manga to fetch
 * @return {Promise<any>}
 */
export const getManga = (mangaId) => fetch(`/api/manga/${mangaId}`)
  .then(handleResponse)
  .catch(handleError);

/**
 * Does a post request to merge a manga
 * @param {string} csrf CSRF token
 * @param {Number|string} baseManga Id of the base manga
 * @param {Number|string} toMerge Id of the manga which will be merged
 * @param {Number|string|undefined} serviceId Optional id of the service which will be merged
 * @return {Promise<any>} Response data from the server
 */
export const postMergeManga = (csrf, baseManga, toMerge, serviceId) => {
  const service = (serviceId === undefined) ? '' : `&service=${serviceId}`;
  return fetch(`/api/manga/merge?base=${baseManga}&toMerge=${toMerge}${service}`, {
    method: 'post',
    headers: csrfHeader(csrf),
  })
    .then(handleResponse)
    .catch(handleError);
};

/**
 * Searches for a manga
 * @param {string} query The search query
 * @param {Boolean} withServices Whether to include services in the result
 */
export const quickSearch = (query, withServices = false) => fetch(
  '/api/quicksearch?query=' + encodeURIComponent(query) + '&withServices=' + encodeURIComponent(withServices)
)
  .then(handleResponse)
  .catch(handleError);
