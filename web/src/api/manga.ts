import {
  type InfiniteData,
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
} from '@tanstack/react-query';
import { minutesToMilliseconds } from 'date-fns';

import type { PageParams } from '#web/api/types';
import {
  type SearchMangaParams,
  MangaSearchResponse,
} from '#web/schemas/manga';
import type {
  FullMangaData,
  MergeMangaResult,
  SearchedManga,
  SearchedMangaWithService,
} from '@/types/api/manga';
import type { DatabaseId } from '@/types/dbTypes';
import { MAX_OFFSET } from '@/webUtils/constants';

import { baseKy, handleError, handleResponse } from './utilities';

export const mangaUrls = {
  manga: (mangaId: DatabaseId | null) => `/api/manga/${mangaId}`,
  merge: '/api/manga/merge',
  search: '/manga/search',
  quickSearch: 'quicksearch',
} as const;

/**
 * Get a manga from the api by id
 * @param {Number|string} mangaId Id of the manga to fetch
 * @return {Promise<FullMangaData>}
 */
export const getManga = (mangaId: DatabaseId): Promise<FullMangaData> => fetch(mangaUrls.manga(mangaId))
  .then(handleResponse<FullMangaData>)
  .catch(handleError);

export const getMangaQueryKey = (mangaId: DatabaseId | null) => [mangaUrls.manga(mangaId)] as const;

export const getMangaQueryOptions = (mangaId: DatabaseId | null) => queryOptions({
  queryKey: getMangaQueryKey(mangaId),
  queryFn: () => getManga(mangaId!),
  enabled: !!mangaId,
});

export type PostMergeMangaParams = {
  baseManga: DatabaseId;
  toMerge: DatabaseId;
  serviceId: DatabaseId | undefined;
};

/**
 * Does a POST request to merge a manga
 * @param baseManga Id of the base manga
 * @param toMerge Id of the manga which will be merged
 * @param  serviceId Optional id of the service which will be merged
 * @return Response data from the server
 */
export const postMergeManga = (
  { baseManga, toMerge, serviceId }: PostMergeMangaParams
): Promise<MergeMangaResult> => {
  const service = (serviceId === undefined) ? '' : `&service=${serviceId}`;
  return fetch(`${mangaUrls.merge}?base=${baseManga}&toMerge=${toMerge}${service}`, {
    method: 'post',
  })
    .then(handleResponse<MergeMangaResult>)
    .catch(handleError);
};

export const DEFAULT_MANGA_LIMIT = 20;

export function searchManga({
  query,
  serviceIds,
  status,
  limit = DEFAULT_MANGA_LIMIT,
  offset,
}: SearchMangaParams & { limit?: number; offset?: number }) {
  return baseKy.get(mangaUrls.search, {
    searchParams: {
      query,
      serviceIds: serviceIds?.join(','),
      status: status?.join(','),
      limit,
      offset,
    },
  })
    .json()
    .then(MangaSearchResponse.parseAsync)
    .catch(handleError);
}

export const searchMangaQueryOptions = (params: SearchMangaParams, limit = DEFAULT_MANGA_LIMIT) => {
  const queryKey = [mangaUrls.search, params] as const;

  return infiniteQueryOptions<MangaSearchResponse, unknown, InfiniteData<MangaSearchResponse, PageParams>, typeof queryKey, PageParams>({
    queryKey,
    queryFn: ({ queryKey: [_, searchParams], pageParam }) => searchManga({
      ...searchParams,
      ...pageParam,
    }),
    // Keeps the previous service ids in view while loading new data.
    // Initial data must not be set because it will override this.
    placeholderData: keepPreviousData,
    initialPageParam: { limit, offset: 0 } satisfies PageParams,
    // We can assume search results are stable for a short while.
    staleTime: minutesToMilliseconds(10),
    getNextPageParam: (lastPage, _, lastPageParam) => {
      const newOffset = lastPageParam.offset + limit;

      if (newOffset > MAX_OFFSET || lastPage.count <= newOffset) {
        return null;
      }

      const isLastPage = lastPageParam.offset >= MAX_OFFSET
        || lastPage.data.searchResults.length < lastPageParam.limit;

      if (isLastPage) {
        return null;
      }

      return {
        limit,
        offset: newOffset,
      };
    },
  });
};

export type SearchResultBasedOnServices<TWithServices extends boolean> =
  TWithServices extends true
    ? SearchedMangaWithService
    : SearchedManga;

type QuickSearch = {
  (query: string, withServices: true, serviceId?: number): Promise<SearchedMangaWithService[]>;
  (query: string, withServices?: false, serviceId?: number): Promise<SearchedManga[]>;
  (query: string, withServices?: boolean, serviceId?: number): Promise<SearchResultBasedOnServices<boolean>[]>;
};

/**
 * Searches for a manga
 * @param {string} query The search query
 * @param {Boolean} withServices Whether to include services in the result
 * @param {Number} serviceId Optional id of the service to filter by
 */
export const quickSearch: QuickSearch = (query: string, withServices = false, serviceId?: number) => baseKy
  .get(mangaUrls.quickSearch,
    {
      searchParams: {
        query,
        withServices,
        serviceId,
      },
    })
  .json<any>()
  .catch(handleError);

export const quickSearchQueryKey = (
  query: string,
  withServices = false,
  serviceId?: number
) => [mangaUrls.quickSearch, query, withServices, serviceId] as const;

export const quickSearchQueryOptions = <TWithServices extends boolean = false>(
  query: string,
  withServices: TWithServices = false as TWithServices,
  serviceId?: number
) => queryOptions({
  queryKey: quickSearchQueryKey(query, withServices, serviceId),
  queryFn: () => quickSearch(query, withServices, serviceId) as Promise<SearchResultBasedOnServices<TWithServices>[]>,
  enabled: query.trim().length >= 1,
  // Keep previous data while loading
  placeholderData: keepPreviousData,
  staleTime: 1000 * 60,
});
