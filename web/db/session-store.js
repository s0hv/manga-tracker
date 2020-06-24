const LRU = require('lru-cache');

const sessionDebug = require('debug')('session-debug');

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
        }

        get(sid, cb = noop) {
            sessionDebug('Create session', sid);
            const sess = this.cache.get(sid);
            if (sess) {
                return cb(null, sess);
            }

            const sql = `SELECT user_id, data, EXTRACT(EPOCH FROM expires_at - CURRENT_TIMESTAMP)*1000 as maxage
                          FROM sessions 
                          WHERE session_id=$1`;

            this.conn.query(sql, [sid])
                .then(res => {
                    if (res.rowCount === 1) {
                        const row = res.rows[0];
                        // TODO Check set behavior
                        this.cache.set(sid, { ...row.data, user_id: row.user_id }, row.maxage);
                        return cb(null, { ...row.data, user_id: row.user_id });
                    }

                    return cb(null, null);
                })
                .catch(err => {
                    sessionDebug('Failed to create session', sid, err);
                    cb(err, null);
                });
        }

        set(sid, session, cb = noop) {
            this.cache.set(sid, session);
            const sql = `INSERT INTO sessions (user_id, session_id, data, expires_at) VALUES ($1, $2, $3, $4)
                         ON CONFLICT (session_id) DO UPDATE SET user_id=$1, data=$3, expires_at=$4`;
            this.conn.query(sql, [session.user_id, sid, session, session.cookie._expires])
                .then(() => cb(null))
                .catch(err => {
                    sessionDebug('Failed to edit session', sid, err);
                    cb(err);
                });
        }

        destroy(sid, cb = noop) {
            sessionDebug('Delete session', sid, this.cache.peek(sid));
            this.cache.del(sid);
            const sql = 'DELETE FROM sessions WHERE session_id=$1';
            this.conn.query(sql, [sid])
                .then(() => cb(null))
                .catch(err => {
                    sessionDebug('Failed to delete session', err);
                    cb(err);
                });
        }

        touch(sid, session, cb = noop) {
            const sql = `UPDATE sessions SET expires_at=CURRENT_TIMESTAMP + INTERVAL '1 ms' * $1
                         WHERE session_id=$2`;
            this.conn.query(sql, [session.cookie.maxAge, sid])
                .then(() => cb(null))
                .catch(err => cb(err));
        }

        clearUserSessions(uid, cb = noop) {
            const sql = 'DELETE FROM sessions WHERE user_id=$1';
            this.cache.forEach((sess, key) => { if (sess.user_id === uid) this.cache.del(key); });
            this.conn.query(sql, [uid])
                .then(() => cb(null))
                .catch(err => {
                    sessionDebug('Failed to clear user sessions with id', uid, err);
                    cb(err);
                });
        }
    }

    return PostgresStore;
};
