import type {
  FullMangaData,
  SearchedManga,
  SearchedMangaWithService,
} from '@/types/api/manga';
import type { DatabaseId } from '@/types/dbTypes';

import { handleError, handleResponse } from './utilities';

/**
 * Get a manga from the api by id
 * @param {Number|string} mangaId Id of the manga to fetch
 * @return {Promise<FullMangaData>}
 */
export const getManga = (mangaId: DatabaseId): Promise<FullMangaData> => fetch(`/api/manga/${mangaId}`)
  .then(handleResponse<FullMangaData>)
  .catch(handleError);

/**
 * Does a post request to merge a manga
 * @param {Number|string} baseManga Id of the base manga
 * @param {Number|string} toMerge Id of the manga which will be merged
 * @param {Number|string|undefined} serviceId Optional id of the service which will be merged
 * @return {Promise<any>} Response data from the server
 */
export const postMergeManga = (baseManga: DatabaseId, toMerge: DatabaseId, serviceId: DatabaseId) => {
  const service = (serviceId === undefined) ? '' : `&service=${serviceId}`;
  return fetch(`/api/manga/merge?base=${baseManga}&toMerge=${toMerge}${service}`, {
    method: 'post',
  })
    .then(handleResponse)
    .catch(handleError);
};


type QuickSearch = {
  (query: string, withServices: true): Promise<SearchedMangaWithService[]>
  (query: string, withServices?: false): Promise<SearchedManga[]>
};

/**
 * Searches for a manga
 * @param {string} query The search query
 * @param {Boolean} withServices Whether to include services in the result
 */
export const quickSearch: QuickSearch = (query: string, withServices: boolean = false) => fetch(
  '/api/quicksearch?query=' + encodeURIComponent(query) + '&withServices=' + encodeURIComponent(withServices)
)
  .then(handleResponse<any>)
  .catch(handleError);
