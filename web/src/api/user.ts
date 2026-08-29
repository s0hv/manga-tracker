import type { Theme } from '@/types/dbTypes';

import { handleError, handleResponse } from './utilities';

export const userUrls = {
  theme: '/api/settings/theme',
  profile: '/api/profile',
  deleteAccount: '/api/user/delete',
} as const;

export const updateUserTheme = (theme: Theme) => fetch(`${userUrls.theme}?value=${theme}`,
  { method: 'post' })
  .then(handleResponse)
  .catch(handleError);


export type UpdateProfileType = {
  username?: string
  password?: string
  newPassword?: string
  repeatPassword?: string
};

export const updateUserProfile = (body: UpdateProfileType) => fetch(userUrls.profile,
  {
    method: 'post',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
  .then(handleResponse)
  .catch(handleError);

export const deleteAccount = () => fetch(userUrls.deleteAccount,
  {
    method: 'POST',
  })
  .then(handleResponse<{ message: string }>)
  .catch(handleError);
