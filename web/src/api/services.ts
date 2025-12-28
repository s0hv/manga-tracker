import { queryOptions } from '@tanstack/react-query';

import { ServiceForApi } from '@/types/api/services';

import { handleError, handleResponse } from './utilities';

export const SERVICES_URL = {
  services: '/api/services',
} as const;

/**
 * Fetches all services
 */
export const getServices = (): Promise<ServiceForApi[]> => fetch(SERVICES_URL.services)
  .then(handleResponse<ServiceForApi[]>)
  .catch(handleError);

export const getServicesQueryOptions = queryOptions({
  queryKey: [SERVICES_URL.services],
  queryFn: getServices,
  select: data => data.reduce<Record<number, ServiceForApi>>(
    (prev, service) => ({
      ...prev,
      [service.serviceId]: service,
    }),
    {}
  ),
});
