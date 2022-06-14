import LRU from 'lru-cache';

import { onSessionExpire } from '../utils/view-counter/index.js';
import { sessionLogger } from '../utils/logging.js';

const mergeSessionViews = (sess, row) => {
  const a = sess.mangaViews || {};
  const b = row.data.mangaViews || {};
  Object.keys(b).forEach(k => {
    a[k] = (a[k] || 0) + b[k];
  });

  return {
    ...sess,
    mangaViews: a,
  };
};


export default (expressSession) => {
  // eslint-disable-next-line prefer-destructuring
  const Store = expressSession.Store;

  const noop = () => {};

  class PostgresStore extends Store {
    constructor(options = {}) {
      super(options);
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
        this.clearInterval = setInterval(() => this.clearOldSessions(), options.clearInterval);
      }
    }

    clearOldSessions() {
      const sql = 'DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP RETURNING data';
      return this.conn.query(sql)
        .then(rows => {
          const sess = rows.reduce(mergeSessionViews, {});
          return onSessionExpire(sess);
        });
    }

    get(sid, cb = noop) {
      const sess = this.cache.get(sid);
      if (sess) {
        return cb(null, sess);
      }
      sessionLogger.debug('Get session from db %s', sid);

      const sql = `SELECT user_id, data, EXTRACT(EPOCH FROM expires_at - CURRENT_TIMESTAMP)*1000 as maxage
                   FROM sessions 
                   WHERE session_id=$1`;

      this.conn.oneOrNone(sql, [sid])
        .then(row => {
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

    set(sid, session, cb = noop) {
      sessionLogger.debug('Edit session %s', sid);
      this.cache.set(sid, session);
      const sql = `INSERT INTO sessions (user_id, session_id, data, expires_at) VALUES ($1, $2, $3, $4)
                   ON CONFLICT (session_id) DO UPDATE SET user_id=$1, data=$3, expires_at=$4`;
      this.conn.query(sql, [session.userId, sid, session, session.cookie._expires])
        .then(() => cb(null))
        .catch(err => {
          sessionLogger.error(err, 'Failed to edit session');
          cb(err);
        });
    }

    destroy(sid, cb = noop) {
      const session = this.cache.peek(sid);
      sessionLogger.debug('Delete session %s %o', sid, session);
      this.cache.delete(sid);
      const sql = 'DELETE FROM sessions WHERE session_id=$1';

      onSessionExpire(session)
        .finally(() => this.conn.query(sql, [sid])
          .then(() => cb(null))
          .catch(err => {
            sessionLogger.error(err, 'Failed to delete session');
            cb(err);
          }));
    }

    touch(sid, session, cb = noop) {
      // No need to touch multiple times per request.
      // If touch was recently called skip this call.
      if (this.touchCache.get(sid) !== undefined) {
        return cb(null);
      }

      const sql = `UPDATE sessions
                   SET expires_at=CURRENT_TIMESTAMP + INTERVAL '1 ms' * $1
                   WHERE session_id=$2`;
      this.conn.query(sql, [session.cookie.maxAge, sid])
        .then(() => {
          this.touchCache.set(sid, true);
          cb(null);
        })
        .catch(err => cb(err));
    }

    clearUserSessions(uid, cb = noop) {
      sessionLogger.info('Clearing all user sessions from user %s', uid);
      const sql = 'DELETE FROM sessions WHERE user_id=$1';
      this.cache.forEach((sess, key) => { if (sess.userId === uid) this.cache.delete(key); });
      this.conn.query(sql, [uid])
        .then(() => cb(null))
        .catch(err => {
          sessionLogger.error(err, 'Failed to clear user sessions with id %s', uid);
          cb(err);
        });
    }
  }

  return PostgresStore;
};
