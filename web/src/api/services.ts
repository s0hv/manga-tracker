import { handleError, handleResponse } from './utilities';
import { ServiceForApi } from '../../types/api/services';

/**
 * Fetches all services
 */
export const getServices: () => Promise<ServiceForApi[]> =
  () => fetch('/api/services')
    .then(handleResponse<ServiceForApi[]>)
    .catch(handleError);
