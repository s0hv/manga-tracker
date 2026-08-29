import { queryOptions } from '@tanstack/react-query';
import type { PaginationState } from '@tanstack/react-table';

import type {
  ChapterRelease,
  ChapterReleaseDates,
  MangaChapter,
  MangaChapterResponse,
} from '@/types/api/chapter';
import type { MangaId } from '@/types/dbTypes';

import { snakeCase } from '../utils/utilities';

import { handleError, handleResponse } from './utilities';

export const chapterUrls = {
  mangaChapters: (mangaId: MangaId) => `/api/manga/${mangaId}/chapters`,
  latestChapters: '/api/chapter/latest',
  chapter: (chapterId: number | string) => `/api/chapter/${chapterId}`,
  mangaReleases: (mangaId: MangaId) => `/api/chapter/releases/${mangaId}`,
} as const;

export type SortBy<T> = {
  id: keyof T
  desc?: boolean
};
/**
 * Fetches chapters for a manga
 * @param mangaId id of the manga to fetch chapters for
 * @param pagination the pagination info for the request
 * @param sortBy A list of objects containing the row name and sorting directions
 * @param services A list of service ids to filter by
 */
export const getChapters = (
  mangaId: MangaId,
  pagination: PaginationState,
  sortBy: SortBy<MangaChapter>[] = [],
  services?: number[]
): Promise<MangaChapterResponse> => {
  const searchParams = new URLSearchParams({
    limit: pagination.pageSize.toString(),
    offset: (pagination.pageIndex * pagination.pageSize).toString(),
  });

  if (sortBy.length > 0) {
    searchParams.set('sortBy', snakeCase(sortBy[0].id));
    searchParams.set('sort', sortBy[0].desc ? 'desc' : 'asc');
  }

  if (services && services.length > 0) {
    searchParams.set('services', services.join(','));
  }

  return fetch(`${chapterUrls.mangaChapters(mangaId)}?${searchParams.toString()}`)
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
  pagination: PaginationState,
  sortBy: SortBy<MangaChapter>[] = [],
  services?: number[]
) => queryOptions({
  queryKey: [chapterUrls.mangaChapters(mangaId), pagination, sortBy, services] as const,
  queryFn: () => getChapters(mangaId, pagination, sortBy, services),
});

/**
 * Fetches the latest chapters
 */
export const getLatestChapters =
  (limit: number | string, offset: number | string, useFollows: boolean): Promise<ChapterRelease[]> => fetch(
    `${chapterUrls.latestChapters}?limit=${limit}&offset=${offset}&useFollows=${useFollows}`
  )
    .then(handleResponse<ChapterRelease[]>)
    .catch(handleError);

export const getLatestChaptersQueryOptions = (
  limit: number | string,
  offset: number | string,
  useFollows: boolean
) => queryOptions({
  queryKey: [chapterUrls.latestChapters, limit, offset, useFollows] as const,
  queryFn: ({ queryKey }) => getLatestChapters(queryKey[1], queryKey[2], queryKey[3]),
});

export type UpdateChapterParams = {
  chapterId: number | string
  data: object
};

/**
 * Updates a chapter with the given data
 */
export const updateChapter = ({ chapterId, data }: UpdateChapterParams) => fetch(chapterUrls.chapter(chapterId),
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
export const deleteChapter = (chapterId: number | string) => fetch(chapterUrls.chapter(chapterId),
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
export const getMangaReleases = (mangaId: MangaId): Promise<ChapterReleaseDates[]> => fetch(chapterUrls.mangaReleases(mangaId))
  .then(handleResponse<ChapterReleaseDates[]>)
  .catch(handleError);

export const getMangaReleasesQueryOptions = (mangaId: MangaId) => queryOptions({
  queryKey: [chapterUrls.mangaReleases(mangaId)] as const,
  queryFn: () => getMangaReleases(mangaId),
});
