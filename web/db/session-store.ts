import LRU from 'lru-cache';
import { type SessionData, Store } from 'express-session';
import type { JSONValue } from 'postgres';

import { onSessionExpire } from '../utils/view-counter';
import { sessionLogger } from '../utils/logging.js';
import type { DatabaseHelpers } from '@/db/helpers';

const mergeSessionViews = (sess: SessionData, row: { data: SessionData }) => {
  const a = sess.mangaViews || {};
  const b = row.data.mangaViews || {};
  Object.keys(b).forEach((k: string) => {
    a[k] = (a[k] || 0) + b[k];
  });

  return {
    ...sess,
    mangaViews: a,
  };
};

const noop = () => {};
type Callback = (err?: any) => void;

export interface StoreOptions {
  clearInterval?: number | null;
  maxAge?: number;
  cacheSize?: number;
  conn?: DatabaseHelpers
}

export default class PostgresStore extends Store {
  private conn: DatabaseHelpers;
  private cache: LRU<string, SessionData>;
  private touchCache: LRU<unknown, unknown>;
  public clearInterval: null | NodeJS.Timer;

  constructor(options: StoreOptions = {}) {
    super();
    if (!options.conn) {
      throw new Error('No postgres connection given');
    }
    this.conn = options.conn;

    this.cache = new LRU({
      max: options.cacheSize || 50,
      ttl: options.maxAge || 7200000, // 2 h in ms
      noDisposeOnSet: true,
    });

    this.touchCache = new LRU({
      max: 50,
      ttl: 1000*2, // 2s
    });

    // Clear sessions every two hours
    if (!Number.isFinite(options.clearInterval)) {
      this.clearInterval = null;
    } else {
      this.clearInterval = setInterval(() => this.clearOldSessions().catch(err => sessionLogger.error(err, 'Failed to clear old sessions')), options.clearInterval!);
    }
  }

  clearOldSessions() {
    const query = this.conn.any<{ data: SessionData }>`DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP RETURNING data`;
    return query
      .then((rows) => {
        if (rows.length === 0) return;

        const sess = rows.reduce(mergeSessionViews, {} as SessionData);
        return onSessionExpire(sess);
      });
  }

  get(sid: string, cb: (err: any, session?: SessionData | null) => void = noop) {
    const sess = this.cache.get(sid);
    if (sess) {
      return cb(null, sess);
    }
    sessionLogger.debug('Get session from db %s', sid);

    const sql = this.conn.oneOrNone`SELECT user_id, data, EXTRACT(EPOCH FROM expires_at - CURRENT_TIMESTAMP)*1000 as maxage
                 FROM sessions 
                 WHERE session_id=${sid}`;

    sql.then(row => {
      if (row) {
        // TODO Check set behavior
        this.cache.set(sid, { ...row.data, userId: row.userId }, { ttl: row.maxage });
        return cb(null, { ...row.data, userId: row.userId });
      }

      return cb(null, null);
    })
      .catch(err => {
        sessionLogger.error(err, 'Failed to create session %s', sid);
        cb(err, null);
      });
  }

  set(sid: string, session: SessionData, cb: Callback = noop) {
    sessionLogger.debug('Edit session %s', sid);
    this.cache.set(sid, session);
    const sessionData = this.conn.sql.json(session as any as JSONValue);
    const sql = this.conn.sql`INSERT INTO sessions (user_id, session_id, data, expires_at)
                              VALUES (${session.userId}, ${sid},
                                      ${sessionData},
                                      ${session.cookie.expires})
                              ON CONFLICT (session_id) DO UPDATE SET user_id=${session.userId},
                                                                     data=${sessionData},
                                                                     expires_at=${session.cookie.expires}`;

    sql.then(() => cb(null))
      .catch(err => {
        sessionLogger.error(err, 'Failed to edit session');
        cb(err);
      });
  }

  destroy(sid: string, cb: Callback = noop) {
    const session = this.cache.peek(sid);
    sessionLogger.debug('Delete session %s %o', sid, session);
    this.cache.delete(sid);

    onSessionExpire(session)
      .finally(() => this.conn.sql`DELETE FROM sessions WHERE session_id=${sid}`
        .then(() => cb(null))
        .catch(err => {
          sessionLogger.error(err, 'Failed to delete session');
          cb(err);
        }));
  }

  touch(sid: string, session: SessionData, cb: Callback = noop) {
    // No need to touch multiple times per request.
    // If touch was recently called skip this call.
    if (this.touchCache.get(sid) !== undefined) {
      return cb(null);
    }

    this.conn.sql`UPDATE sessions
                 SET expires_at=CURRENT_TIMESTAMP + INTERVAL '1 ms' * ${session.cookie.maxAge}
                 WHERE session_id=${sid}`
      .then(() => {
        this.touchCache.set(sid, true);
        cb(null);
      })
      .catch(err => cb(err));
  }

  clearUserSessions(uid: number, cb: Callback = noop) {
    sessionLogger.info('Clearing all user sessions from user %s', uid);
    this.cache.forEach((sess, key) => { if (sess.userId === uid) this.cache.delete(key); });
    this.conn.sql`DELETE FROM sessions WHERE user_id=${uid}`
      .then(() => cb(null))
      .catch(err => {
        sessionLogger.error(err, 'Failed to clear user sessions with id %s', uid);
        cb(err);
      });
  }
}
