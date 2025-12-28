import { addDays } from 'date-fns';
import { noop } from 'es-toolkit';
import type {
  NextFunction,
  Request,
  Response,
} from 'express-serve-static-core';

import {
  clearUserSessions,
  deleteSession,
  getSession,
  regenerateSession,
  validateSessionToken,
} from '@/db/session';
import { getUser } from '@/db/user';
import {
  SECURE_COOKIE_OPTIONS,
  serverCookieNames,
} from '@/serverUtils/constants';
import { Unauthorized } from '@/serverUtils/errors';
import { sessionLogger } from '@/serverUtils/logging';
import { limiterSlowBruteByIP } from '@/serverUtils/ratelimits';
import { setSessionCookie } from '@/serverUtils/requestHelpers';
import {
  base64toUint8Array,
  constantTimeEqual,
  generateSecureRandomBytes,
  hashSecret,
  uint8ArrayToBase64,
} from '@/serverUtils/utilities';
import type { AuthToken } from '@/types/db/auth';
import type { User } from '@/types/db/user';
import type { SafeSession } from '@/types/session';

import { db } from './helpers';

const AUTH_TOKEN_LENGTH = 32;
const LOOKUP_TOKEN_LENGTH = 10;


export const authenticateUser = async (email: string, password: string): Promise<User> => {
  if (password.length > 72) {
    throw new Unauthorized('Invalid login');
  }

  const user = await db.oneOrNone<User>`
    SELECT   
      u.email,
      u.username,
      u.user_uuid,
      u.user_id,
      u.theme,
      u.admin
    FROM users u
    WHERE email=${email} AND pwhash IS NOT NULL AND pwhash=crypt(${password}, pwhash)`;

  if (!user) {
    throw new Unauthorized('Invalid login');
  }

  return user;
};

export const useSessionAndUser = async (req: Request, res: Response, next: NextFunction) => {
  req.session = null;

  const sessionToken = req.signedCookies[serverCookieNames.session];

  if (!sessionToken || req.isStaticResource) {
    return next();
  }

  const session = await validateSessionToken(sessionToken);

  if (!session) return next();

  const user = session.userId
    // The foreign key should ensure that this always exists
    ? await getUser(session.userId, { expectExists: true })
    : null;

  // Remove secrets
  req.session = {
    sessionId: session.sessionId,
    userId: session.userId,
    expiresAt: session.expiresAt,
    data: session.data,
  } satisfies SafeSession;

  req.user = user;

  next();
};

const getAuthToken = (userUUID: string, lookup: string): Promise<AuthToken | null> => {
  return db.oneOrNone<AuthToken>`
    SELECT token.user_id, token_hash, lookup, expires_at 
    FROM auth_token token
      INNER JOIN users u ON token.user_id = u.user_id
    WHERE u.user_uuid=${userUUID} AND lookup=${lookup}`;
};

export type AuthTokenResponse = {
  token: string
  expiresAt: Date
};

export const generateAuthToken = async (userId: number, userUUID: string): Promise<AuthTokenResponse> => {
  const lookup = uint8ArrayToBase64(generateSecureRandomBytes(LOOKUP_TOKEN_LENGTH));
  const token = generateSecureRandomBytes(AUTH_TOKEN_LENGTH);
  const expiresAt = addDays(new Date(), 30);

  const data: AuthToken = {
    userId,
    lookup,
    tokenHash: await hashSecret(token),
    expiresAt,
  };

  await db.none`INSERT INTO auth_token ${db.sql(data)}`;

  return {
    token: formatAuthToken(lookup, token, userUUID),
    expiresAt,
  };
};

export const regenerateAuthToken = async (
  userId: number,
  lookup: string,
  userUUID: string
) => {
  const newLookup = uint8ArrayToBase64(generateSecureRandomBytes(LOOKUP_TOKEN_LENGTH));
  const token = generateSecureRandomBytes(AUTH_TOKEN_LENGTH);
  const tokenHash = await hashSecret(token);

  const row = await db.one<Pick<AuthToken, 'expiresAt'>>`
    UPDATE auth_token 
    SET token_hash=${tokenHash}, lookup=${newLookup} 
    WHERE user_id=${userId} AND lookup=${lookup} 
    RETURNING expires_at`;

  if (!row) {
    throw new Unauthorized('Invalid token');
  }

  return {
    token: formatAuthToken(newLookup, token, userUUID),
    expiresAt: row.expiresAt,
  };
};

export async function authenticateByAuthCookie(authCookie: string, req: Request, res: Response) {
  const ratelimit = await limiterSlowBruteByIP.get(req.ip ?? '');

  if (ratelimit !== null && ratelimit.remainingPoints <= 0) {
    throw new Error('Ratelimited. Try again later');
  }

  // authLogger.debug('Checking auth from db for %s %s', req.originalUrl, req.cookies.auth);
  const authTokenCookie = parseAuthCookie(authCookie);

  if (!authTokenCookie) {
    res.clearCookie(serverCookieNames.authToken);

    if (req.session) {
      req.session.userId = null;
      await deleteSession(req.session.sessionId);
    }

    return;
  }

  const authToken = await getAuthToken(authTokenCookie.userUUID, authTokenCookie.lookup);

  if (!authToken) {
    sessionLogger.info('Session not found. Clearing cookie');
    res.clearCookie(serverCookieNames.authToken);

    if (req.session) {
      await deleteSession(req.session.sessionId)
        .finally(() => {
          req.session = null;
        });
    }

    return;
  }

  const tokenHash = await hashSecret(authTokenCookie.token);

  if (!constantTimeEqual(tokenHash, authToken.tokenHash)) {
    sessionLogger.info('Invalid auth token found for user. Sessions cleared');
    res.clearCookie(serverCookieNames.authToken);

    await Promise.all([
      req.session ? deleteSession(req.session.sessionId) : noop(),
      clearUserSessions(authToken.userId),
      clearUserAuthTokens(authToken.userId),
      limiterSlowBruteByIP.consume(req.ip ?? ''),
    ])
      .finally(() => {
        req.session = null;
      });

    return;
  }

  const user = await getUser(authToken.userId, { expectExists: true });

  const {
    token: newToken,
    expiresAt,
  } = await regenerateAuthToken(authToken.userId, authTokenCookie.lookup, user.userUuid);

  // Regenerate and refetch the session
  const { sessionId: newSessionId, token } = await regenerateSession(req.session?.sessionId, user.userId);
  const session = await getSession(newSessionId);

  if (!session) {
    sessionLogger.error('Failed to fetch newly created session during remember me procedure');
    return;
  }

  setSessionCookie(
    { token, expiresAt: session.expiresAt },
    res
  );

  res.cookie(serverCookieNames.authToken, newToken, {
    ...SECURE_COOKIE_OPTIONS,
    expires: expiresAt,
  });
}

function clearUserAuthTokens(userId: number) {
  return db.none`DELETE FROM auth_token WHERE user_id=${userId}`;
}

function parseAuthCookie(authCookie: string): null | { lookup: string, token: Uint8Array, userUUID: string } {
  /*
  Try to find the remember me token.
  If found associate current session with user and regenerate session id (this is important)
  If something fails or user isn't found we remove possible user id from session and continue
   */
  const [lookup, token, uuidBase64] = authCookie.split('.', 3);
  if (!uuidBase64) {
    return null;
  }

  const uuid = Buffer.from(uuidBase64, 'base64').toString('ascii');

  if (uuid.length < 32) {
    return null;
  }

  return {
    lookup,
    token: base64toUint8Array(token),
    userUUID: uuid,
  };
}

const formatAuthToken = (lookup: string, token: Uint8Array, userUUID: string) =>
  `${lookup}.${uint8ArrayToBase64(token)}.${Buffer.from(userUUID).toString('base64')}`;
