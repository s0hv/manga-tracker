const LRU = require('lru-cache');

const mangaViews = require('../utils/view-counter/manga-view-counter');
const { sessionLogger } = require('../utils/logging');

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


module.exports = (expressSession) => {
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
        maxAge: options.maxAge || 7200000, // 2 h in ms
        noDisposeOnSet: true,
      });

      this.touchCache = new LRU({
        max: 50,
        maxAge: 1000*2, // 2s
      });

      // Clear sessions every two hours
      this.clearInterval = setInterval(() => this.clearOldSessions(), options.clearInterval || 7.2e+6);
    }

    clearOldSessions() {
      const sql = 'DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP RETURNING data';
      return this.conn.query(sql)
        .then(rows => {
          const sess = rows.reduce(mergeSessionViews, {});
          return mangaViews.onSessionExpire(sess);
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
            this.cache.set(sid, { ...row.data, user_id: row.user_id }, row.maxage);
            return cb(null, { ...row.data, user_id: row.user_id });
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
      this.conn.query(sql, [session.user_id, sid, session, session.cookie._expires])
        .then(() => cb(null))
        .catch(err => {
          sessionLogger.error(err, 'Failed to edit session');
          cb(err);
        });
    }

    destroy(sid, cb = noop) {
      const session = this.cache.peek(sid);
      sessionLogger.debug('Delete session %s %o', sid, session);
      this.cache.del(sid);
      const sql = 'DELETE FROM sessions WHERE session_id=$1';

      mangaViews.onSessionExpire(session)
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
      this.cache.forEach((sess, key) => { if (sess.user_id === uid) this.cache.del(key); });
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
