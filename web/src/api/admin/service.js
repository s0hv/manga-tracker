import { csrfHeader } from '../../utils/csrf';
import { handleResponse, handleError } from '../utilities';

export const editService = (csrf, serviceId, body) => fetch(`/api/admin/editService/${serviceId}`,
  {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader(csrf),
    },
    body: JSON.stringify(body),
  })
  .then(handleResponse)
  .catch(handleError);
