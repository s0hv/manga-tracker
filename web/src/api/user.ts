import { csrfHeader } from '../utils/csrf';
import { handleError, handleResponse } from './utilities';
import type { Theme } from '@/types/dbTypes';

export const updateUserTheme = (csrf: string, theme: Theme) => fetch(`/api/settings/theme?value=${theme}`,
  {
    method: 'post',
    headers: csrfHeader(csrf),
  })
  .then(handleResponse)
  .catch(handleError);


export type UpdateProfileType = {
  username?: string
  password?: string
  newPassword?: string
  repeatPassword?: string
}

export const updateUserProfile = (csrf: string, body: UpdateProfileType) => fetch('/api/profile',
  {
    method: 'post',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...csrfHeader(csrf),
    },
  })
  .then(handleResponse)
  .catch(handleError);

export const deleteAccount = (csrf: string) => fetch('/api/user/delete',
  {
    method: 'POST',
    headers: csrfHeader(csrf),
  })
  .then(handleResponse<{ message: string }>)
  .catch(handleError);
