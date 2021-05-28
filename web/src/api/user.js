import { csrfHeader } from '../utils/csrf';
import { handleResponse, handleError } from './utilities';

export const updateUserTheme = (csrf, theme) => fetch(`/api/settings/theme?value=${theme}`,
  {
    method: 'post',
    headers: csrfHeader(csrf),
  })
  .then(handleResponse)
  .catch(handleError);

/**
 * Logout the user. Does not handle errors
 * @param csrf CSRF token
 * @return {Promise<Response>} Returns the response object
 */
export const logoutUser = (csrf) => fetch('/api/logout',
  {
    method: 'post',
    headers: csrfHeader(csrf),
  });

export const loginUser = (csrf, body) => fetch('/api/login',
  {
    method: 'post',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...csrfHeader(csrf),
    },
    redirect: 'follow',
  });

export const updateUserProfile = (csrf, body) => fetch('/api/profile',
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
