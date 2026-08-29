import { mutationOptions } from '@tanstack/react-query';

import { DatabaseId } from '@/types/dbTypes';

import { handleError, handleResponse } from '../utilities';

export const adminServiceUrls = {
  editService: (serviceId: DatabaseId) => `/api/admin/editService/${serviceId}`,
} as const;

export type EditServiceParams = {
  serviceId: DatabaseId
  body: Record<string, unknown>
};

export const editService = ({ serviceId, body }: EditServiceParams) => fetch(adminServiceUrls.editService(serviceId),
  {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  .then(handleResponse)
  .catch(handleError);

export const editServiceMutationOptions = mutationOptions({
  mutationFn: editService,
});
