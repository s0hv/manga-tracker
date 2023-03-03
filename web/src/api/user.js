import { csrfHeader } from '../utils/csrf';
import { handleResponse, handleError } from './utilities';

export const updateUserTheme = (csrf, theme) => fetch(`/api/settings/theme?value=${theme}`,
  {
    method: 'post',
    headers: csrfHeader(csrf),
  })
  .then(handleResponse)
  .catch(handleError);


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
