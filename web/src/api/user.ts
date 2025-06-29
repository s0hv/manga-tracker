import type { Theme } from '@/types/dbTypes';

import { handleError, handleResponse } from './utilities';

export const updateUserTheme = (theme: Theme) => fetch(`/api/settings/theme?value=${theme}`,
  { method: 'post' })
  .then(handleResponse)
  .catch(handleError);


export type UpdateProfileType = {
  username?: string
  password?: string
  newPassword?: string
  repeatPassword?: string
};

export const updateUserProfile = (body: UpdateProfileType) => fetch('/api/profile',
  {
    method: 'post',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
  .then(handleResponse)
  .catch(handleError);

export const deleteAccount = () => fetch('/api/user/delete',
  {
    method: 'POST',
  })
  .then(handleResponse<{ message: string }>)
  .catch(handleError);
