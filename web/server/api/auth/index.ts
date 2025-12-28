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
  SECURE_COOKIE_OPTIONS,
  serverCookieNames,
} from '@/serverUtils/constants';
import { sessionLogger } from '@/serverUtils/logging';
import { limiterSlowBruteByIP } from '@/serverUtils/ratelimits';
import {
  clearRedirectCookie,
  getRedirectFromHeader,
  getRedirectUrl,
} from '@/serverUtils/redirect';
import { setSessionCookie } from '@/serverUtils/requestHelpers';

import { router } from './common';

router.post('/logout', async (req, res) => {
  const sessionToken = req.signedCookies[serverCookieNames.session];
  const session = await validateSessionToken(sessionToken ?? '');

  res.clearCookie(serverCookieNames.session);
  res.clearCookie(serverCookieNames.authToken);

  if (!session) {
    return res.redirect('/');
  }

  await deleteSession(session.sessionId);

  // Update user last activity in the background
  if (session.userId) {
    void updateUserLastActivity(session.userId);
  }

  res.redirect(getRedirectFromHeader(req) ?? '/');
});

const LoginForm = z.object({
  email: z.string(),
  password: z.string().max(72),
  rememberMe: z.boolean().optional(),
});

router.post('/login', async (req, res) => {
  const form = LoginForm.parse(req.body);

  const ratelimitKey = req.ip ?? '';
  await limiterSlowBruteByIP.consume(ratelimitKey);

  const user = await authenticateUser(form.email, form.password);

  // On successful login, restore rate limit point
  await limiterSlowBruteByIP.reward(ratelimitKey);

  if (form.rememberMe) {
    const { token, expiresAt } = await generateAuthToken(user.userId, user.userUuid);
    res.cookie(serverCookieNames.authToken, token, {
      ...SECURE_COOKIE_OPTIONS,
      expires: expiresAt,
    });
  }

  const session = await createSession(user.userId);
  setSessionCookie(session, res);

  // Update user last activity in the background
  void updateUserLastActivity(user.userId);

  clearRedirectCookie(res);
  res.redirect(getRedirectUrl(req));
});

// Since this is used for a redirect, it must be a GET request
router.get('/restore-login', async (req, res) => {
  // Must have valid referrer
  const fetchMode = req.header('sec-fetch-mode')?.toLowerCase();
  const fetchDest = req.header('sec-fetch-dest')?.toLowerCase();

  // Only allow top level navigations to call this endpoint
  if (fetchMode !== 'navigate' || fetchDest !== 'document') {
    sessionLogger.warn('Tried to restore login from a non-navigate request. Sec-Fetch-Mode: %s, Sec-Fetch-Dest: %s', fetchMode, fetchDest);
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
  res.clearCookie(serverCookieNames.authRestore);

  // Set the redirect path
  const redirectPath = getRedirectUrl(req);
  clearRedirectCookie(res);
  res.location(redirectPath)
    .status(302);

  const authToken = req.signedCookies[serverCookieNames.authToken] as string | undefined;

  // If auth token does not exist or session is already active, just redirect back
  if (!authToken || req.session?.userId) {
    res.end();
    return;
  }

  await authenticateByAuthCookie(authToken, req, res);
  res.end();
});

export default function register(app: Application) {
  app.use('/api/auth', router);
}
