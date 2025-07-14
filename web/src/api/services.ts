import { ServiceForApi } from '@/types/api/services';

import { handleError, handleResponse } from './utilities';

/**
 * Fetches all services
 */
export const getServices: () => Promise<ServiceForApi[]> =
  () => fetch('/api/services')
    .then(handleResponse<ServiceForApi[]>)
    .catch(handleError);
