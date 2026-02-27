import type { Application } from 'express-serve-static-core';
import z from 'zod';

import { updateUserLastActivity } from '#server/api/user';
import {
  authenticateByAuthCookie,
  authenticateUser,
  generateAuthToken,
} from '@/db/auth';
import {
  createSession,
  deleteSession,
  validateSessionToken,
} from '@/db/session';
import {
  HOST_URL,
  SECURE_COOKIE_OPTIONS,
  serverCookieNames,
} from '@/serverUtils/constants';
import { sessionLogger } from '@/serverUtils/logging';
import {
  accountLoginLimiter,
  getLoginRatelimitKey,
} from '@/serverUtils/ratelimits';
import {
  clearRedirectCookie,
  getRedirectFromHeader,
  getRedirectUrl,
} from '@/serverUtils/redirect';
import {
  clearSecureCookie,
  setSessionCookie,
} from '@/serverUtils/requestHelpers';
import { validateRequest } from '@/serverUtils/validators';

import { router } from './common';
import { discordCallbackHandler } from './discord';
import { registerProviderRoute } from './oauth2';

router.post('/logout', async (req, res) => {
  const sessionToken = req.signedCookies[serverCookieNames.session];
  const session = await validateSessionToken(sessionToken ?? '');

  clearSecureCookie(res, serverCookieNames.session);
  clearSecureCookie(res, serverCookieNames.authToken);

  if (!session) {
    return res.redirect('/');
  }

  await deleteSession(session.sessionId);

  // Update the users last activity in the background
  if (session.userId) {
    void updateUserLastActivity(session.userId);
  }

  res.redirect(getRedirectFromHeader(req) ?? '/');
});

const LoginForm = z.object({
  email: z.string(),
  /** Password length validated by {@link authenticateUser} */
  password: z.string(),
  rememberMe: z.union([z.boolean(), z.literal('true').transform(() => true)]).optional(),
}).strict();

router.post('/login',
  validateRequest({ body: LoginForm }),
  async (req, res) => {
    const form = req.body;

    const ratelimitKey = getLoginRatelimitKey(req);
    await accountLoginLimiter.consume(ratelimitKey);

    const user = await authenticateUser(form.email, form.password);

    // On successful login, restore rate limit point
    await accountLoginLimiter.reward(ratelimitKey);

    if (form.rememberMe) {
      const { token, expiresAt } = await generateAuthToken(user.userId, user.userUuid);
      res.cookie(serverCookieNames.authToken, token, {
        ...SECURE_COOKIE_OPTIONS,
        expires: expiresAt,
      });
    }

    const session = await createSession(user.userId);
    setSessionCookie(session, res);

    // Update the users last activity in the background
    void updateUserLastActivity(user.userId);

    clearRedirectCookie(res);
    res.redirect(getRedirectUrl(req));
  });

// Since this is used for a redirect, it must be a GET request
router.get('/restore-login', async (req, res) => {
  // Must be a browser navigation request
  const fetchMode = req.header('sec-fetch-mode')?.toLowerCase();
  const fetchDest = req.header('sec-fetch-dest')?.toLowerCase();

  // Try to parse the referer URL from the headers if it exists
  let referrerUrl: URL | null = null;
  const referer = req.header('Referer');

  try {
    if (referer) {
      referrerUrl = new URL(referer);
    }
  } catch (err) {
    sessionLogger.error(err, 'Failed to parse referrer url');
  }

  const isSameOrigin = referrerUrl?.origin === HOST_URL.origin;

  // Only allow top level navigations to call this endpoint
  if (
    // When doing a navigation when the session has expired,
    // on an open mobile browser tab, for example,
    // the fetch-mode will be 'cors'. In that case just validate that
    // the referrer is from the same origin.
    !(fetchMode === 'cors' && isSameOrigin)
    && (
      fetchMode !== 'navigate'
      || fetchDest !== 'document')
  ) {
    sessionLogger.warn(
      'Tried to restore login from a non-navigate request. Sec-Fetch-Mode: %s, Sec-Fetch-Dest: %s, Origin: %s',
      fetchMode,
      fetchDest,
      req.header('Origin')
    );
    res.status(400).end();
    return;
  }

  const validRequestCookie = req.cookies[serverCookieNames.authRestore];

  if (validRequestCookie !== '1') {
    sessionLogger.warn('Tried to restore login without a valid restore cookie set');
    res.status(400).end();
    return;
  }

  // We want to clear this asap
  clearSecureCookie(res, serverCookieNames.authRestore);

  // Set the redirect path
  const redirectPath = getRedirectUrl(req);
  clearRedirectCookie(res);
  res.location(redirectPath)
    .status(302);

  const authToken = req.signedCookies[serverCookieNames.authToken] as string | undefined;

  // If the auth token does not exist or the session is already active, just redirect back
  if (!authToken || req.session?.userId) {
    res.end();
    return;
  }

  await authenticateByAuthCookie(authToken, req, res);
  res.end();
});

registerProviderRoute('discord', discordCallbackHandler);

export default function register(app: Application) {
  app.use('/api/auth', router);
}
