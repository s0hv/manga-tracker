import { queryOptions } from '@tanstack/react-query';

import type {
  MangaService,
  MangaServiceCreateData,
  MangaServiceUpdateData,
  ScheduledRun,
} from '@/types/api/manga';
import type { DatabaseId, MangaId, MangaStatus } from '@/types/dbTypes';

import { handleError, handleResponse } from '../utilities';

export const ADMIN_MANGA_URL = {
  mangaServices: (mangaId: MangaId) => `/api/admin/manga/${mangaId}/services`,
} as const;

export const getScheduledRuns = (mangaId: MangaId) => fetch(`/api/admin/manga/${mangaId}/scheduledRuns`)
  .then(handleResponse<ScheduledRun[]>)
  .catch(handleError);

export const createScheduledRun = (mangaId: MangaId, serviceId: DatabaseId) => fetch(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`,
  {
    method: 'POST',
  })
  .then(handleResponse<{ inserted: ScheduledRun }>)
  .catch(handleError);

export const deleteScheduledRun = (mangaId: MangaId, serviceId: DatabaseId) => fetch(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`,
  {
    method: 'DELETE',
  })
  .then(handleResponse)
  .catch(handleError);


export type UpdateMangaTitleResponse = { message: string };

/**
 * Updates the title of a manga
 * @param {Number|string} mangaId Id of the manga
 * @param {string} title New title of the manga
 */
export const updateMangaTitle = (mangaId: MangaId, title: string) => fetch(`/api/admin/manga/${mangaId}/title`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  })
  .then(handleResponse<UpdateMangaTitleResponse>)
  .catch(handleError);

export type MangaInfo = {
  status: MangaStatus
};

export const updateMangaInfo = (mangaId: MangaId, info: MangaInfo) => fetch(`/api/admin/manga/${mangaId}/info`,
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

export const updateMangaService = (
  mangaId: MangaId, serviceId: DatabaseId, data: MangaServiceUpdateData
) => fetch(`/api/admin/manga/${mangaId}/services/${serviceId}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mangaService: data }),
  })
  .then(handleResponse)
  .catch(handleError);

export const createMangaService = (
  mangaId: MangaId, serviceId: DatabaseId, data: MangaServiceCreateData
) => fetch(`/api/admin/manga/${mangaId}/services/${serviceId}/create`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mangaService: data }),
  })
  .then(handleResponse)
  .catch(handleError);

