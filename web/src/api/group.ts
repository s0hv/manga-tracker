import { queryOptions } from '@tanstack/react-query';
import { identity } from 'es-toolkit';

import { SearchGroupResponse } from '#web/schemas/group';

import { baseKy } from './utilities';

const groupUrls = {
  search: '/groups/search',
} as const;

export const searchGroups = (
  name: string,
  limit: number = 10,
  signal: AbortSignal
) => baseKy
  .get(groupUrls.search, {
    searchParams: {
      name,
      limit,
    },
    signal,
  })
  .json()
  .then(SearchGroupResponse.parseAsync)
  .then(res => res.data);

export const searchGroupsQueryOptions = (name: string, limit: number = 10) => queryOptions({
  queryKey: [groupUrls.search, name, limit] as const,
  queryFn: ({ queryKey, signal }) => searchGroups(queryKey[1], queryKey[2], signal),
  enabled: !!name,
  // Keep previous data while loading
  placeholderData: identity,
});
