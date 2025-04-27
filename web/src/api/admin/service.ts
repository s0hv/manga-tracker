import { DatabaseId } from '@/types/dbTypes';
import { handleError, handleResponse } from '../utilities';

export const editService = (serviceId: DatabaseId, body: Record<string, unknown>) => fetch(`/api/admin/editService/${serviceId}`,
  {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  .then(handleResponse)
  .catch(handleError);
