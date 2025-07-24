import { queryOptions } from '@tanstack/react-query';

import type {
  ChapterRelease,
  ChapterReleaseDates,
  MangaChapter,
  MangaChapterResponse,
} from '@/types/api/chapter';
import type { MangaId } from '@/types/dbTypes';

import { snakeCase } from '../utils/utilities';

import { handleError, handleResponse } from './utilities';

export type SortBy<T> = {
  id: keyof T
  desc?: boolean
};
/**
 * Fetches chapters for a manga
 * @param mangaId id of the manga to fetch chapters for
 * @param limit limit of the fetched chapters
 * @param offset current offset
 * @param sortBy A list of objects containing the row name and sorting directions
 * @param services A list of service ids to filter by
 */
export const getChapters = (
  mangaId: MangaId,
  limit: number | string,
  offset: number | string,
  sortBy: SortBy<MangaChapter>[] = [],
  services?: number[]
): Promise<MangaChapterResponse> => {
  const searchParams = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  if (sortBy.length > 0) {
    searchParams.set('sortBy', snakeCase(sortBy[0].id));
    searchParams.set('sort', sortBy[0].desc ? 'desc' : 'asc');
  }

  if (services && services.length > 0) {
    searchParams.set('services', services.join(','));
  }

  return fetch(`/api/manga/${mangaId}/chapters?${searchParams.toString()}`)
    .then(handleResponse<MangaChapterResponse>)
    .then(res => {
      res.chapters.forEach(ch => {
        ch.releaseDate = new Date(ch.releaseDate);
      });

      return res;
    })
    .catch(handleError);
};

export const getChaptersQueryOptions = (
  mangaId: MangaId,
  limit: number | string,
  offset: number | string,
  sortBy: SortBy<MangaChapter>[] = [],
  services?: number[]
) => queryOptions({
  queryKey: ['mangaChapters', mangaId, limit, offset, sortBy, services] as const,
  queryFn: ({ queryKey: [_, ...params] }) => getChapters(...params),
});

/**
 * Fetches the latest chapters
 */
export const getLatestChapters =
  (limit: number | string, offset: number | string, useFollows: boolean): Promise<ChapterRelease[]> => fetch(
    `/api/chapter/latest?limit=${limit}&offset=${offset}&useFollows=${useFollows}`
  )
    .then(handleResponse<ChapterRelease[]>)
    .catch(handleError);

/**
 * Updates a chapter with the given data
 * @param {Number|string} chapterId Id of the chapter to be updated
 * @param {object} data Update data
 */
export const updateChapter = (chapterId: number | string, data: object) => fetch(`/api/chapter/${chapterId}`,
  {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  .then(handleResponse<{ message: string }>)
  .catch(handleError);

/**
 * Deletes a chapter with the given id
 * @param {Number|string} chapterId Id of the chapter to delete
 */
export const deleteChapter = (chapterId: number | string) => fetch(`/api/chapter/${chapterId}`,
  {
    method: 'delete',
  })
  .then(handleResponse<{ message: string }>)
  .catch(handleError);

/**
 * Gets the chapter releases for a manga
 * @param {Number|string} mangaId Id of the manga to get releases for
 * @return {Promise<ChapterReleaseDates[]>}
 */
export const getMangaReleases = (mangaId: MangaId): Promise<ChapterReleaseDates[]> => fetch(`/api/chapter/releases/${mangaId}`)
  .then(handleResponse<ChapterReleaseDates[]>)
  .catch(handleError);
