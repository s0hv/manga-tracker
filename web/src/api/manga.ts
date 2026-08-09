import { queryOptions } from '@tanstack/react-query';

import type {
  FullMangaData,
  MergeMangaResult,
  SearchedManga,
  SearchedMangaWithService,
} from '@/types/api/manga';
import type { DatabaseId } from '@/types/dbTypes';

import { baseKy, handleError, handleResponse } from './utilities';

/**
 * Get a manga from the api by id
 * @param {Number|string} mangaId Id of the manga to fetch
 * @return {Promise<FullMangaData>}
 */
export const getManga = (mangaId: DatabaseId): Promise<FullMangaData> => fetch(`/api/manga/${mangaId}`)
  .then(handleResponse<FullMangaData>)
  .catch(handleError);

export const getMangaQueryOptions = (mangaId: DatabaseId | null) => queryOptions({
  queryKey: [mangaId] as const,
  queryFn: ({ queryKey: [mangaIdKey] }) => getManga(mangaIdKey!),
  enabled: !!mangaId,
});

/**
 * Does a POST request to merge a manga
 * @param baseManga Id of the base manga
 * @param toMerge Id of the manga which will be merged
 * @param  serviceId Optional id of the service which will be merged
 * @return Response data from the server
 */
export const postMergeManga = (
  baseManga: DatabaseId,
  toMerge: DatabaseId,
  serviceId: DatabaseId | undefined
): Promise<MergeMangaResult> => {
  const service = (serviceId === undefined) ? '' : `&service=${serviceId}`;
  return fetch(`/api/manga/merge?base=${baseManga}&toMerge=${toMerge}${service}`, {
    method: 'post',
  })
    .then(handleResponse<MergeMangaResult>)
    .catch(handleError);
};


export type SearchResultBasedOnServices<TWithServices extends boolean> =
  TWithServices extends true
    ? SearchedMangaWithService
    : SearchedManga;

type QuickSearch = {
  (query: string, withServices: true, serviceId?: number): Promise<SearchedMangaWithService[]>
  (query: string, withServices?: false, serviceId?: number): Promise<SearchedManga[]>
  (query: string, withServices?: boolean, serviceId?: number): Promise<SearchResultBasedOnServices<boolean>[]>
};

/**
 * Searches for a manga
 * @param {string} query The search query
 * @param {Boolean} withServices Whether to include services in the result
 * @param {Number} serviceId Optional id of the service to filter by
 */
export const quickSearch: QuickSearch = (query: string, withServices: boolean = false, serviceId?: number) => baseKy
  .get('quicksearch',
    {
      searchParams: {
        query,
        withServices,
        serviceId,
      },
    })
  .json<any>()
  .catch(handleError);
