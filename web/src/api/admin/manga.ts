import { mutationOptions, queryOptions } from '@tanstack/react-query';

import type {
  MangaService,
  MangaServiceCreateData,
  MangaServiceUpdateData,
  ScheduledRun,
} from '@/types/api/manga';
import type { DatabaseId, MangaId, MangaStatus } from '@/types/dbTypes';

import { handleError, handleResponse } from '../utilities';

export const ADMIN_MANGA_URL = {
  scheduledRuns: (mangaId: MangaId) => `/api/admin/manga/${mangaId}/scheduledRuns`,
  scheduledRun: (mangaId: MangaId, serviceId: DatabaseId) => `/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`,
  title: (mangaId: MangaId) => `/api/admin/manga/${mangaId}/title`,
  info: (mangaId: MangaId) => `/api/admin/manga/${mangaId}/info`,
  mangaServices: (mangaId: MangaId) => `/api/admin/manga/${mangaId}/services`,
  mangaService: (mangaId: MangaId, serviceId: DatabaseId) => `/api/admin/manga/${mangaId}/services/${serviceId}`,
  createMangaService: (mangaId: MangaId, serviceId: DatabaseId) => `/api/admin/manga/${mangaId}/services/${serviceId}/create`,
} as const;

export const getScheduledRuns = (mangaId: MangaId) => fetch(ADMIN_MANGA_URL.scheduledRuns(mangaId))
  .then(handleResponse<ScheduledRun[]>)
  .catch(handleError);

export const getScheduledRunsKey = (mangaId: MangaId) =>
  ['getScheduledRuns', mangaId] as const;

export const getScheduledRunsQueryOptions = (mangaId_: MangaId) => queryOptions({
  queryKey: getScheduledRunsKey(mangaId_),
  queryFn: ({ queryKey: [_, mangaId] }) => getScheduledRuns(mangaId),
});

type ScheduledRunParams = {
  mangaId: MangaId
  serviceId: DatabaseId
};
export const createScheduledRun = (
  { mangaId, serviceId }: ScheduledRunParams
) => fetch(ADMIN_MANGA_URL.scheduledRun(mangaId, serviceId),
  { method: 'POST' })
  .then(handleResponse<{ inserted: ScheduledRun }>)
  .catch(handleError);

export const createScheduledRunMutationOptions = mutationOptions({
  mutationFn: createScheduledRun,
  meta: {
    queryKeysToInvalidate: [['getScheduledRuns']],
    invalidateOnError: true,
  },
});

export const deleteScheduledRun = (
  { mangaId, serviceId }: ScheduledRunParams
) => fetch(ADMIN_MANGA_URL.scheduledRun(mangaId, serviceId),
  { method: 'DELETE' })
  .then(handleResponse)
  .catch(handleError);

export const deleteScheduledRunMutationOptions = mutationOptions({
  mutationFn: deleteScheduledRun,
  meta: {
    queryKeysToInvalidate: [['getScheduledRuns']],
    invalidateOnError: true,
  },
});

export type UpdateMangaTitleResponse = { message: string };

export type UpdateMangaTitleParams = {
  mangaId: MangaId
  title: string
};

/**
 * Updates the title of a manga
 */
export const updateMangaTitle = ({ mangaId, title }: UpdateMangaTitleParams) => fetch(ADMIN_MANGA_URL.title(mangaId),
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  })
  .then(handleResponse<UpdateMangaTitleResponse>)
  .catch(handleError);

export const updateMangaTitleMutationOptions = mutationOptions({
  mutationFn: updateMangaTitle,
});

export type MangaInfo = {
  status: MangaStatus
};

export const updateMangaInfo = (mangaId: MangaId, info: MangaInfo) => fetch(ADMIN_MANGA_URL.info(mangaId),
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(info),
  })
  .then(handleResponse)
  .catch(handleError);


export const getMangaServices = (mangaId: MangaId) => fetch(ADMIN_MANGA_URL.mangaServices(mangaId))
  .then(handleResponse<MangaService[]>)
  .then(data => data.map(ms => {
    ms.lastCheck = ms.lastCheck ? new Date(ms.lastCheck) : null;
    ms.nextUpdate = ms.nextUpdate ? new Date(ms.nextUpdate) : null;
    return ms;
  }))
  .catch(handleError);

export const getMangaServicesQueryOptions = (mangaId: MangaId) => queryOptions({
  queryKey: [ADMIN_MANGA_URL.mangaServices(mangaId)] as const,
  queryFn: () => getMangaServices(mangaId),
});

export type UpdateMangaServiceParams = {
  mangaId: MangaId
  serviceId: DatabaseId
  data: MangaServiceUpdateData
};

export const updateMangaService = (
  { mangaId, serviceId, data }: UpdateMangaServiceParams
) => fetch(ADMIN_MANGA_URL.mangaService(mangaId, serviceId),
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mangaService: data }),
  })
  .then(handleResponse)
  .catch(handleError);

export const updateMangaServiceMutationOptions = mutationOptions({
  mutationFn: updateMangaService,
});

export type CreateMangaServiceParams = {
  mangaId: MangaId
  serviceId: DatabaseId
  data: MangaServiceCreateData
};

export const createMangaService = (
  { mangaId, serviceId, data }: CreateMangaServiceParams
) => fetch(ADMIN_MANGA_URL.createMangaService(mangaId, serviceId),
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mangaService: data }),
  })
  .then(handleResponse)
  .catch(handleError);

export const createMangaServiceMutationOptions = mutationOptions({
  mutationFn: createMangaService,
  meta: {
    queryKeysToInvalidate: [
      variables => [ADMIN_MANGA_URL.mangaServices((variables as CreateMangaServiceParams).mangaId)],
    ],
  },
});
