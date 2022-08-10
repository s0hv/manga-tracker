import { handleError, handleResponse } from './utilities';
import { csrfHeader } from '../utils/csrf';
import { snakeCase } from '../utils/utilities';
import type {
  MangaChapter,
  MangaChapterResponse,
} from '../../types/api/chapter';
import type { MangaId } from '../../types/dbTypes';

export type SortBy<T> = {
  id: keyof T,
  desc?: boolean
}
/**
 * Fetches chapters for a manga
 * @param {Number|string} mangaId id of the manga to fetch chapters for
 * @param {Number|string} limit limit of the fetched chapters
 * @param {Number|string} offset current offset
 * @param {Object[]} sortBy A list of objects containing the row name and sorting directions
 */
export const getChapters =
  (mangaId: MangaId, limit: number | string, offset: number | string, sortBy: SortBy<MangaChapter>[] = []): Promise<MangaChapterResponse> => {
    const orderBy = sortBy.length > 0 ?
      `&sortBy=${snakeCase(sortBy[0].id)}&sort=${sortBy[0].desc ? 'desc' : 'asc'}` : '';
    return fetch(`/api/manga/${mangaId}/chapters?limit=${limit}&offset=${offset}${orderBy}`)
      .then(handleResponse<MangaChapterResponse>)
      .then(res => {
        res.chapters.forEach(ch => {
          ch.releaseDate = new Date(ch.releaseDate);
        });

        return res;
      })
      .catch(handleError);
  };

/**
 * Fetches the latest chapters
 * @param {Number|string} limit limit of the fetched chapters
 * @param {Number|string} offset current offset
 * @return {Promise<any>}
 */
export const getLatestChapters =
  (limit: number | string, offset: number | string): Promise<any> => fetch(
    `/api/chapter/latest?limit=${limit}&offset=${offset}`
  )
    .then(handleResponse)
    .catch(handleError);

/**
 * Updates a chapter with the given data
 * @param {string} csrf CSRF token
 * @param {Number|string} chapterId Id of the chapter to be updated
 * @param {object} data Update data
 */
export const updateChapter = (csrf: string, chapterId: number | string, data: object) => fetch(`/api/chapter/${chapterId}`,
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
export const deleteChapter = (csrf: string, chapterId: number | string) => fetch(`/api/chapter/${chapterId}`,
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
export const getMangaReleases = (mangaId: MangaId) => fetch(`/api/chapter/releases/${mangaId}`)
  .then(handleResponse)
  .catch(handleError);
