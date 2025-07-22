import { queryOptions } from '@tanstack/react-query';

import { ServiceForApi } from '@/types/api/services';
import { QueryKeys } from '@/webUtils/constants';

import { handleError, handleResponse } from './utilities';

/**
 * Fetches all services
 */
export const getServices = (): Promise<ServiceForApi[]> => fetch('/api/services')
  .then(handleResponse<ServiceForApi[]>)
  .catch(handleError);

export const getServicesQueryOptions = queryOptions({
  queryKey: QueryKeys.Services,
  queryFn: getServices,
  select: data => data.reduce<Record<number, ServiceForApi>>(
    (prev, service) => ({
      ...prev,
      [service.serviceId]: service,
    }),
    {}
  ),
});
