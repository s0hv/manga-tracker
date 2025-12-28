import * as arctic from 'arctic';
import { minutesToMilliseconds } from 'date-fns';
import express from 'express';
import type {
  CookieOptions,
  Request,
  Response,
} from 'express-serve-static-core';

import type { OAuthProvider } from '@/common/auth/providers';
import { createSession } from '@/db/session';
import { createOAuthUser, getUserByProviderAccountId } from '@/db/user';
import {
  SECURE_COOKIE_OPTIONS,
  serverCookieNames,
} from '@/serverUtils/constants';
import { logger } from '@/serverUtils/logging';
import {
  clearRedirectCookie,
  getRedirectUrl,
} from '@/serverUtils/redirect';
import { setSessionCookie } from '@/serverUtils/requestHelpers';

export type CallbackHandler = (req: Request, res: Response) => Promise<void>;

export const router = express.Router();

export const oauthCookieOptions = {
  ...SECURE_COOKIE_OPTIONS,
  // These cookies can be short-lived
  maxAge: minutesToMilliseconds(10),
  path: '/api/auth',
} as const satisfies CookieOptions;

export const OauthProviderConstructors = {
  discord: arctic.Discord,
} as const satisfies Record<OAuthProvider, unknown>;


export type OAuthProviders = {
  discord: arctic.Discord
};

export const registerProvider = <TPrefix extends OAuthProvider>(prefix: TPrefix): OAuthProviders[TPrefix] => {
  logger.info(`Registering ${prefix} OAuth provider`);
  const clientId = process.env[`${prefix.toUpperCase()}_CLIENT_ID`];

  if (!clientId) {
    throw new Error(`Client id not provided for provider ${prefix}`);
  }

  const clientSecret = process.env[`${prefix.toUpperCase()}_CLIENT_SECRET`];

  if (!clientSecret) {
    throw new Error(`Client secret not provided for provider ${prefix}`);
  }

  const redirectUri = `${process.env.HOST}/api/auth/${prefix.toLowerCase()}/callback`;

  return new OauthProviderConstructors[prefix](
    clientId,
    clientSecret,
    redirectUri
  );
};

export const OAUTH_PROVIDERS: OAuthProviders = {
  discord: registerProvider('discord'),
};

export const oauthLoginHandler = (
  providerName: OAuthProvider,
  req: Request,
  res: Response
) => {
  const provider = OAUTH_PROVIDERS[providerName];

  const state = arctic.generateState();
  const codeVerifier = arctic.generateCodeVerifier();
  const scopes = ['email'];
  const url = provider.createAuthorizationURL(state, codeVerifier, scopes);

  const cookieOptions: CookieOptions = {
    ...oauthCookieOptions,
    path: `/api/auth/${providerName}`,
  };

  res.cookie(serverCookieNames.oauthState(providerName), state, cookieOptions);
  res.cookie(serverCookieNames.oauthVerifier(providerName), codeVerifier, cookieOptions);

  res.redirect(url.toString());
};

export const getOauthTokens = async (
  providerName: OAuthProvider,
  req: Request,
  res: Response
): Promise<arctic.OAuth2Tokens | undefined> => {
  const provider = OAUTH_PROVIDERS[providerName];
  const code = req.query.code;
  const state = req.query.state;

  const storedState = req.signedCookies[serverCookieNames.oauthState(providerName)] ?? null;
  const codeVerifier = req.signedCookies[serverCookieNames.oauthVerifier(providerName)] ?? null;

  if (!code || !state || !storedState || !codeVerifier) {
    res.status(400).end();
    return;
  }

  if (state !== storedState) {
    res.status(400).end();
    return;
  }

  try {
    return await provider.validateAuthorizationCode(code.toString(), codeVerifier);
  } catch {
    // Invalid code or client credentials
    res.status(400).end();
    return;
  }
};

export const finishLoginCallback = async (
  providerName: OAuthProvider,
  userInfo: {
    username: string
    accountId: string
    email: string
  },
  req: Request,
  res: Response
) => {
  const { username, accountId, email } = userInfo;

  let user = await getUserByProviderAccountId(providerName, accountId);

  if (!user) {
    try {
      user = await createOAuthUser({
        username,
        provider: providerName,
        accountId,
        email,
      });
    } catch (err: unknown) {
      //  We should probably handle this better
      logger.error(`Failed to create OAuth user: ${err}`);
      res.status(400).end();
      return;
    }
  }

  if (!user) {
    res.status(500).end();
    return;
  }

  // Create the session and set the token in the cookie
  const session = await createSession(user.userId);

  setSessionCookie(session, res);
  clearRedirectCookie(res);
  res.redirect(getRedirectUrl(req));
};
