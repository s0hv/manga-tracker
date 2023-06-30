import type { Adapter, AdapterSession, AdapterUser } from 'next-auth/adapters';
import { LRUCache as LRU } from 'lru-cache';
import type { JSONValue } from 'postgres';
import type { DatabaseHelpers } from '@/db/helpers';

import { createSingleton } from '@/serverUtils/utilities';
import { onSessionExpire } from '@/serverUtils/view-counter';
import { dbLogger, sessionLogger } from '@/serverUtils/logging';
import { userSelect } from '@/db/auth';
import { generateUpdate } from '@/db/utils';


export type PostgresAdapter = Adapter<false> & {
  deleteUserFromCache: (userId: string) => void
  deleteSessionFromCache: (sessionId: string) => void
  getSession: (sessionId: string) => Promise<AdapterSession | null>
  clearOldSessions: () => Promise<void>
  updateUserLastActivity: (userId: string) => Promise<void>

  userCache: LRU<string, AdapterUser>,
  sessionCache: LRU<string, AdapterSession>
  clearInterval: null | NodeJS.Timer
};

export interface CacheOptions {
  maxAge?: number
  cacheSize?: number
}

export interface StoreOptions {
  clearInterval?: number | null
  userCacheOpts?: CacheOptions
  sessionCacheOpts?: CacheOptions
}


/**
 * Create a singleton adapter. After the first call will return the same adapter
 * even if settings are changed
 */
export const getSingletonPostgresAdapter = (db: DatabaseHelpers, options: StoreOptions = {}): PostgresAdapter => {
  return createSingleton<PostgresAdapter>('postgres-adapter', () => PostgresAdapter(db, options));
};

export const PostgresAdapter = (db: DatabaseHelpers, options: StoreOptions = {}): PostgresAdapter => {
  if (!db) throw new Error('Db helpers must be given as the first parameter');

  const userCache = new LRU<string, AdapterUser>({
    max: options.userCacheOpts?.cacheSize || 50,
    ttl: options.userCacheOpts?.maxAge || 7200000, // 2 h in ms
    noDisposeOnSet: true,
    updateAgeOnGet: true,
  });

  const sessionCache = new LRU<string, AdapterSession>({
    max: options.sessionCacheOpts?.cacheSize || 50,
    ttl: options.sessionCacheOpts?.maxAge || 7200000, // 2 h in ms
    noDisposeOnSet: true,
  });

  const clearOldSessions: PostgresAdapter['clearOldSessions'] = () => {
    return db.none`DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP`;
  };

  type GetUser = {
    (id: string, expectExists: true, noCache?: boolean): Promise<AdapterUser>,
    (id: string, expectExists?: false, noCache?: boolean): Promise<AdapterUser | null>,
  }

  const getUser: GetUser = (async (id: string, expectExists = false, noCache = false) => {
    if (!noCache) {
      const cachedUser = userCache.get(id);
      if (cachedUser) {
        return cachedUser;
      }
    }

    const method = expectExists ? db.one : db.oneOrNone;
    return method<AdapterUser>`SELECT ${userSelect} FROM users u WHERE user_uuid=${id}`
      .then(user => {
        if (user) userCache.set(id, user);
        return user;
      });
  }) as GetUser;

  /**
   * @param sessionToken
   * @param noCache If set to true cache won't be used for fetching
   */
  const getSession = async (sessionToken: string, noCache = false) => {
    sessionLogger.debug('Getting session');
    if (!noCache) {
      const cachedSession = sessionCache.get(sessionToken);
      if (cachedSession) return cachedSession;
    }

    const session = await db.oneOrNone<AdapterSession>`
      SELECT user_id, session_id as session_token, expires_at as expires, data
      FROM sessions 
      WHERE session_id=${sessionToken}`;

    if (session) {
      sessionCache.set(sessionToken, session, { ttl: Math.max(session.expires.getTime() - Date.now(), 0) });
    }

    return session;
  };

  const adapter: PostgresAdapter = {
    userCache,
    sessionCache,
    clearInterval: null,
    clearOldSessions,

    deleteUserFromCache(userId) {
      userCache.delete(userId);
    },

    deleteSessionFromCache(sessionId) {
      sessionCache.delete(sessionId);
    },

    createUser(user) {
      return db.one<{ userUuid: string }>`INSERT INTO users (username, email, pwhash, is_credentials_account) VALUES (${user.name}, ${user.email}, NULL, FALSE) RETURNING user_uuid`
        .then(({ userUuid }) => getUser(userUuid, true));
    },

    getUser,
    getSession,

    getUserByEmail(email) {
      return db.oneOrNone<AdapterUser>`SELECT ${userSelect} FROM users u WHERE email=${email}`;
    },

    getUserByAccount({ providerAccountId, provider }) {
      return db.oneOrNone`
        SELECT ${userSelect}
        FROM users u INNER JOIN account a ON u.user_uuid = a.user_id 
        WHERE "provider"=${provider} AND provider_account_id=${providerAccountId}`;
    },

    // https://next-auth.js.org/configuration/events#updateuser
    async updateUser(user) {
      sessionLogger.debug('Updating user');
      // Disabled as the update process is not that clearly documented
      // await db.any`UPDATE users SET ${generateUpdate(user, db.sql)} WHERE user_uuid=${user.id}`;
      return getUser(user.id!, true, true);
    },

    async deleteUser(userId) {
      const user = await getUser(userId);
      if (!user) return null;

      await db.any`DELETE FROM users WHERE user_uuid=${userId}`;
      userCache.delete(userId);

      return user;
    },

    updateUserLastActivity(userId) {
      return db.none`UPDATE users SET last_active=CURRENT_TIMESTAMP WHERE user_uuid=${userId}`;
    },

    linkAccount(account) {
      return db.none`INSERT INTO account ${db.sql(account, 'type', 'provider', 'providerAccountId', 'refresh_token', 'access_token', 'expires_at', 'token_type', 'scope', 'id_token', 'session_state', 'userId')}`;
    },

    unlinkAccount({ providerAccountId, provider }) {
      return db.none`DELETE FROM account WHERE provider=${provider} AND provider_account_id=${providerAccountId}`;
    },

    async createSession({ sessionToken, userId, expires, data }: Pick<AdapterSession, 'sessionToken' | 'userId' | 'expires' | 'data'>) {
      sessionLogger.debug('Create session');
      return db.one<AdapterSession>`
        INSERT INTO sessions (user_id, session_id, expires_at, data) 
        VALUES (${userId}, ${sessionToken}, ${expires}, ${db.sql.json(data ? data as unknown as JSONValue : null)}) 
        RETURNING user_id, expires_at as expires, session_id as session_token, data`;
    },

    async getSessionAndUser(sessionToken) {
      sessionLogger.debug('Getting session and user');
      const session = await getSession(sessionToken);

      if (!session) {
        return null;
      }

      const user = await getUser(session.userId);
      if (!user) {
        return null;
      }

      return {
        session,
        user,
      };
    },

    async updateSession({ sessionToken, expires, data }) {
      await db.any`UPDATE sessions SET ${generateUpdate({ expires, data }, db.sql)} WHERE session_id=${sessionToken}`;
      return getSession(sessionToken, true);
    },

    async deleteSession(sessionToken) {
      return db.oneOrNone<AdapterSession>`
        DELETE FROM sessions 
        WHERE session_id=${sessionToken} 
        RETURNING session_id as session_token, expires_at as expires, user_id, data, delete_user
      `
        .then<AdapterSession | null>(sess => {
          sessionCache.delete(sessionToken);

          if (sess) {
            onSessionExpire(sess)
              .catch((err: any) => dbLogger.error(err, 'Failed to count manga views'));
          }
          return sess;
        });
    },
  };

  let clearInterval: null | NodeJS.Timer;
  if (!Number.isFinite(options.clearInterval)) {
    clearInterval = null;
  } else {
    clearInterval = setInterval(() => adapter.clearOldSessions().catch((err: any) => sessionLogger.error(err, 'Failed to clear old sessions')), options.clearInterval!);
  }

  adapter.clearInterval = clearInterval;

  return adapter;
};
