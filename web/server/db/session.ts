import { addHours, addMinutes, isBefore } from 'date-fns';
import type {
  NextFunction,
  Request,
  Response,
} from 'express-serve-static-core';
import { LRUCache } from 'lru-cache';

import { db } from '@/db/helpers';
import { generateUpdate } from '@/db/utils';
import { serverCookieNames } from '@/serverUtils/constants';
import { dbLogger, logger, sessionLogger } from '@/serverUtils/logging';
import { setSessionCookie } from '@/serverUtils/requestHelpers';
import {
  base64toUint8Array,
  constantTimeEqual,
  createSingleton,
  generateSecureRandomBytes,
  hashSecret,
  uint8ArrayToBase64,
} from '@/serverUtils/utilities';
import { onSessionExpire } from '@/serverUtils/view-counter';
import type { SafeSession, Session, SessionWithToken } from '@/types/session';
import type { PartialExcept } from '@/types/utility';

const SESSION_AGE_HOURS = 2;

export const sessionCache = createSingleton('sessionCache', () => new LRUCache<string, Session>({
  max: 50,
  ttl: 7200000, // 2 h in ms
  noDisposeOnSet: true,
}));

type SessionClearInterval = {
  handle: null | NodeJS.Timeout
};

const sessionClearIntervalHandle = createSingleton<SessionClearInterval>('sessionClearInterval', () => ({
  handle: null,
}));

/**
 * Sets the session clear interval and starts clearing sessions.
 *
 * @param clearIntervalMs the interval to clear sessions in milliseconds
 * @param clearSessionsFn the function to call to clear sessions. Should only be set for testing purposes.
 */
export function setSessionClearInterval(clearIntervalMs: number | null, clearSessionsFn = clearOldSessions): NodeJS.Timeout | undefined {
  if (clearIntervalMs === null) {
    if (sessionClearIntervalHandle.handle) {
      clearInterval(sessionClearIntervalHandle.handle);
    }
    return;
  }

  if (!Number.isFinite(clearIntervalMs)) {
    return;
  }

  // Stop the old interval if it exists
  if (sessionClearIntervalHandle.handle) {
    clearInterval(sessionClearIntervalHandle.handle);
  }

  const handle = setInterval(
    () => clearSessionsFn()
      .catch((err: any) => sessionLogger.error(err, 'Failed to clear old sessions')),
    clearIntervalMs
  );

  sessionClearIntervalHandle.handle = handle;

  return handle;
}

export async function clearOldSessions() {
  const data = await db.manyOrNone`DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP RETURNING data, session_id`;

  data.forEach(({ sessionId }) => sessionCache.delete(sessionId));

  for (const session of data) {
    try {
      await onSessionExpire(session);
    } catch (err) {
      sessionLogger.error(err, 'Failed to count manga views');
    }
  }
}

export async function createSession(userId: number | null): Promise<Pick<SessionWithToken, 'token' | 'expiresAt' | 'sessionId'>> {
  const now = new Date();

  const id = uint8ArrayToBase64(generateSecureRandomBytes(15));
  const secret = generateSecureRandomBytes(24);
  const secretHash = await hashSecret(secret);

  const token = id + '.' + uint8ArrayToBase64(secret);

  const expiresAt = addHours(now, SESSION_AGE_HOURS);

  const sessionData: Session = {
    userId,
    sessionId: id,
    expiresAt,
    data: null,
    sessionSecret: secretHash,
  } as const;

  await db.none`INSERT INTO sessions ${db.sql(sessionData)}`;

  return { token, expiresAt, sessionId: id };
}

export async function validateSessionToken(token: string): Promise<Session | null> {
  const tokenParts = token.split('.');
  if (tokenParts.length !== 2) {
    return null;
  }

  const sessionId = tokenParts[0];
  const sessionSecret = tokenParts[1];

  const session = await getSession(sessionId);

  if (!session) {
    return null;
  }

  const tokenSecretHash = await hashSecret(base64toUint8Array(sessionSecret));
  const validSecret = constantTimeEqual(tokenSecretHash, session.sessionSecret);

  if (!validSecret) {
    return null;
  }

  return session;
}

export async function getSession(sessionId: string, useCache: boolean): Promise<Session | null>;
export async function getSession(sessionId: string): Promise<Session | null>;
export async function getSession(sessionId: string, useCache = true): Promise<Session | null> {
  const now = new Date();

  let session: Session | undefined | null = useCache
    ? sessionCache.get(sessionId)
    : null;

  if (!session) {
    session = await db.oneOrNone<Session>`
      SELECT session_id, user_id, expires_at, data, session_secret
      FROM sessions 
      WHERE session_id = ${sessionId}`;

    logger.trace('Setting session %s', sessionId);

    if (session) {
      sessionCache.set(sessionId, session);
    }
  }

  if (!session) {
    return null;
  }

  // Check expiration
  if (now >= session.expiresAt) {
    await deleteSession(sessionId);
    return null;
  }

  return session;
}

type UpdateSessionParams = PartialExcept<
  Pick<Session, 'data' | 'expiresAt' | 'sessionId'>,
  'sessionId'
>;

export async function updateSession({ sessionId, expiresAt, data }: UpdateSessionParams) {
  await db.none`UPDATE sessions SET ${generateUpdate({ expiresAt, data }, db.sql)} WHERE session_id=${sessionId}`;
  sessionCache.delete(sessionId);
}

/**
 * Updates the session `expiresAt` so the session will last for {@link SESSION_AGE_HOURS}
 */
export async function touchSessionOnRequest(req: Request, res: Response, next: NextFunction) {
  const session = req.session;

  // Refresh session expiry only if less than 30 min to expiry
  if (!session || isBefore(addMinutes(new Date(), 30), session.expiresAt)) {
    next();
    return;
  }

  const expiresAt = addHours(new Date(), SESSION_AGE_HOURS);
  await updateSession({ sessionId: session.sessionId, expiresAt });

  setSessionCookie({
    token: req.signedCookies[serverCookieNames.session],
    expiresAt,
  }, res);

  next();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const session = await db.oneOrNone<SafeSession>`
      DELETE FROM sessions
      WHERE session_id = ${sessionId}
      RETURNING session_id, expires_at, user_id, data`;

  sessionCache.delete(sessionId);

  if (!session) return;

  void onSessionExpire(session)
    .catch((err: unknown) => dbLogger.error(err, 'Failed to count manga views'));
}

export async function regenerateSession(sessionId: string | undefined, userId: number | null) {
  if (sessionId) {
    await deleteSession(sessionId);
  }

  return createSession(userId);
}

/**
 * Extends the session expiration to 2 hours from now and invalidates it from the cache.
 */
export async function extendSessionDuration(sessionId: string) {
  const expiresAt = addHours(new Date(), SESSION_AGE_HOURS);

  await db.none`UPDATE sessions
                SET expires_at=${expiresAt}
                WHERE session_id = ${sessionId}`;

  // Invalidate cache as the session has changed
  sessionCache.delete(sessionId);
}

export async function clearUserSessions(userId: number) {
  await db.none`DELETE FROM sessions WHERE user_id = ${userId}`;

  sessionCache.forEach(session => {
    if (session.userId === userId) {
      sessionCache.delete(session.sessionId);
    }
  });
}
