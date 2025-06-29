import { expect } from 'vitest';

import { authTokenExists, sessionExists } from './dbutils';
import { getCookie } from './utils';

export async function expectSessionRegenerated(agent, oldSess) {
  const sess = getCookie(agent, 'sess');
  expect(sess.value).not.toEqual(oldSess.value);

  expect(await sessionExists(oldSess.value)).toBeFalse();
  return sess;
}

export async function expectAuthTokenRegenerated(agent, oldAuth) {
  const auth = getCookie(agent, 'auth');
  expect(auth.value).not.toEqual(oldAuth.value);

  expect(await authTokenExists(oldAuth.value)).toBeFalse();
  return auth;
}
