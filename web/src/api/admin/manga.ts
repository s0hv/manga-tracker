import { handleError, handleResponse } from '../utilities';
import { csrfHeader } from '@/webUtils/csrf';
import type { DatabaseId, MangaId, MangaStatus } from '@/types/dbTypes';
import type {
  MangaService,
  MangaServiceCreateData,
  MangaServiceUpdateData,
  ScheduledRun,
} from '@/types/api/manga';

export const getScheduledRuns = (mangaId: MangaId) => fetch(`/api/admin/manga/${mangaId}/scheduledRuns`)
  .then(handleResponse<ScheduledRun[]>)
  .catch(handleError);

export const createScheduledRun = (csrf: string, mangaId: MangaId, serviceId: DatabaseId) => fetch(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`,
  {
    method: 'POST',
    headers: csrfHeader(csrf),
  })
  .then(handleResponse<{ inserted: ScheduledRun }>)
  .catch(handleError);

export const deleteScheduledRun = (csrf: string, mangaId: MangaId, serviceId: DatabaseId) => fetch(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`,
  {
    method: 'DELETE',
    headers: csrfHeader(csrf),
  })
  .then(handleResponse)
  .catch(handleError);


export type UpdateMangaTitleResponse = { message: string };

/**
 * Updates the title of a manga
 * @param {string} csrf CSRF token
 * @param {Number|string} mangaId Id of the manga
 * @param {string} title New title of the manga
 */
export const updateMangaTitle = (csrf: string, mangaId: MangaId, title: string) => fetch(`/api/admin/manga/${mangaId}/title`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(csrf),
    },
    body: JSON.stringify({ title }),
  })
  .then(handleResponse<UpdateMangaTitleResponse>)
  .catch(handleError);

export type MangaInfo = {
  status: MangaStatus
}

export const updateMangaInfo = (csrf: string, mangaId: MangaId, info: MangaInfo) => fetch(`/api/admin/manga/${mangaId}/info`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(csrf),
    },
    body: JSON.stringify(info),
  })
  .then(handleResponse)
  .catch(handleError);


export const getMangaServices = (mangaId: MangaId) => fetch(`/api/admin/manga/${mangaId}/services`,
  {
    method: 'GET',
  })
  .then(handleResponse<MangaService[]>)
  .then(data => data.map(ms => {
    ms.lastCheck = ms.lastCheck ? new Date(ms.lastCheck) : null;
    ms.nextUpdate = ms.nextUpdate ? new Date(ms.nextUpdate) : null;
    return ms;
  }))
  .catch(handleError);

export const updateMangaService = (
  csrf: string, mangaId: MangaId, serviceId: DatabaseId, data: MangaServiceUpdateData
) => fetch(`/api/admin/manga/${mangaId}/services/${serviceId}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(csrf),
    },
    body: JSON.stringify({ mangaService: data }),
  })
  .then(handleResponse)
  .catch(handleError);

export const createMangaService = (
  csrf: string, mangaId: MangaId, serviceId: DatabaseId, data: MangaServiceCreateData
) => fetch(`/api/admin/manga/${mangaId}/services/${serviceId}/create`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(csrf),
    },
    body: JSON.stringify({ mangaService: data }),
  })
  .then(handleResponse)
  .catch(handleError);

