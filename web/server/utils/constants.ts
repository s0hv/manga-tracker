import type { CookieOptions } from 'express-serve-static-core';

import type { OAuthProvider } from '@/common/auth/providers';

// We can use a fallback here for cypress.
// It should not be used elsewhere, and env var checks should stop execution
// if HOST is missing
export const HOST_URL = new URL(process.env.HOST ?? 'http://localhost:3000');
export const csrfMissing = 'CSRF error. Modifying requests must come from the same origin.';
export const IS_PROD = process.env.ENVIRONMENT === 'production';
export const IS_NON_PROD = !IS_PROD;
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
export const isTest = process.env.NODE_ENV === 'test';
export const NO_GROUP = 1;

// We should probably determine this some other way
export const isSecure = HOST_URL.protocol === 'https:';
export const cookiePrefix = isSecure ? '__Secure-' : '';
// This should be set for OAuth cookies since we set a custom path to them
export const httpCookiePrefix = isSecure ? '__Http-' : '';

export const serverCookieNames = {
  authToken: `${cookiePrefix}mt-auth-token`,
  // Set before redirecting to the remember me handler
  authRestore: `${cookiePrefix}mt-auth-restore`,
  session: `${cookiePrefix}mt-session`,
  oauthState: (provider: OAuthProvider) => `${httpCookiePrefix}${provider}_oauth_state`,
  oauthVerifier: (provider: OAuthProvider) => `${httpCookiePrefix}${provider}_oauth_verifier`,
};

export const SECURE_COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax',
  secure: isSecure,
  httpOnly: true,
  signed: true,
} as const satisfies CookieOptions;
