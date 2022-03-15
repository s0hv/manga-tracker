import { handleResponse, handleError } from './utilities';

/**
 * Fetches all services
 */
export const getServices =
  () => fetch('/api/services')
    .then(handleResponse)
    .catch(handleError);
