import { csrfHeader } from '../../utils/csrf';
import { handleResponse, handleError } from '../utilities';

export const editService = (csrf, body) => fetch('/api/admin/editService',
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
