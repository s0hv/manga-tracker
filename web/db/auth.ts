import LRU from 'lru-cache';
import crypto from 'crypto';

import type {
  Express,
  NextFunction,
  Request,
  Response,
} from 'express-serve-static-core';

import { bruteforce } from '../utils/ratelimits.js';
import { db } from './helpers';
import { authLogger, sessionLogger } from '../utils/logging.js';
import type { DatabaseId, SessionUser } from '@/types/dbTypes';
import type { User } from '@/types/db/user';
import type { PartialExcept } from '@/types/utility';


const userCache = new LRU<number, SessionUser>(({
  max: 50,
  ttl: 86400000, // 1 day in ms
  noDisposeOnSet: true,
  updateAgeOnGet: true,
}));

const userPromises: Map<string, Promise<number | undefined>> = new Map();

const dev = process.env.NODE_ENV !== 'production';

export async function generateAuthToken(uid: DatabaseId, userUUID: string) {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(32+9, (err, buf) => {
      if (err) {
        return reject(err);
      }

      const token = buf.toString('base64', 0, 33);
      const lookup = buf.toString('base64', 33);

      const age = 2592e+6; // 30 days
      const sql = db.sql`INSERT INTO auth_tokens (user_id, hashed_token, expires_at, lookup) VALUES (${uid}, encode(digest(${token}, 'sha256'), 'hex'), ${new Date(Date.now() + age)}, ${lookup})`;

      resolve(sql.execute()
        .then(() => `${lookup};${token};${Buffer.from(userUUID).toString('base64')}`));
    });
  });
}

function regenerateAuthToken(uid: DatabaseId, lookup: string, userUUID: string, cb: (err: null | any, token: string | false, expiresAt?: Date) => any) {
  crypto.randomBytes(32, (err, buf) => {
    if (err) {
      return cb(err, false, undefined);
    }

    const token = buf.toString('base64');

    return db.one`UPDATE auth_tokens SET hashed_token=encode(digest(${token}, 'sha256'), 'hex') WHERE user_id=${uid} AND lookup=${lookup} RETURNING expires_at`
      .then(row => {
        cb(null, `${lookup};${token};${Buffer.from(userUUID).toString('base64')}`, row.expiresAt);
      })
      .catch(sqlErr => cb(sqlErr, false, undefined));
  });
}

export const authenticate = (req: Request, email: string, password: string, cb: (err: any, row: false | User) => any) => {
  if (password.length > 72) return cb(null, false);

  return db.oneOrNone<User>`SELECT user_id, username, user_uuid, theme, admin FROM users WHERE email=${email} AND pwhash=crypt(${password}, pwhash)`
    .then(row => {
      if (!row) {
        return cb(null, false);
      }

      cb(null, row);
    })
    .catch(err => {
      console.error(err);
      cb(err, false);
    });
};

export const setUserOnLogin = (req: Request, user: User) => {
  req.session.userId = user.userId;
  userCache.set(user.userId, {
    userId: user.userId,
    username: user.username,
    uuid: user.userUuid,
    theme: user.theme,
    admin: user.admin,
  });
};

export const createRememberMeToken = (req: Request, user: User) => {
  return generateAuthToken(user.userId, user.userUuid)
    .then(token => {
      // Try to regen session
      return new Promise((resolve, reject) => req.session.regenerate((err) => {
        if (err) {
          console.error(err);
          req.session.userId = undefined;
          return reject(err);
        }

        setUserOnLogin(req, user);

        resolve(token);
      }));
    });
};

export function getUser(uid: number | undefined, cb: (user: SessionUser | null, err: null | any) => any) {
  if (!uid) return cb(null, null);

  const user = userCache.get(uid);
  if (user) return cb(user, null);

  return db.oneOrNone<User>`SELECT username, user_uuid, theme, admin FROM users WHERE user_id=${uid}`
    .then(row => {
      if (!row) return cb(null, null);

      const val = {
        username: row.username,
        uuid: row.userUuid,
        userId: uid,
        theme: row.theme,
        admin: row.admin,
      };
      userCache.set(uid, val);
      cb(val, null);
    })
    .catch(err => {
      authLogger.error(err);
      cb(null, err);
    });
}

export const requiresUser = (req: Request, res: Response, next: NextFunction) => {
  getUser(req.session.userId, (user, err) => {
    req.user = user;
    next(err);
  });
};

/**
 * @param {Number} uid
 * @return {Promise<any>}
 */
export function clearUserAuthTokens(uid: number) {
  return db.sql`DELETE FROM auth_tokens WHERE user_id=${uid}`.execute();
}

function getUserByToken(lookup: string, token: string, uuid: string) {
  return db.oneOrNone<User>`
    SELECT u.user_id, u.username, u.user_uuid, u.theme, u.admin
    FROM auth_tokens INNER JOIN users u on u.user_id=auth_tokens.user_id 
    WHERE expires_at > NOW() AND user_uuid=${uuid} AND lookup=${lookup} AND hashed_token=encode(digest(${token}, 'sha256'), 'hex')
  `;
}

function parseAuthCookie(authCookie: string): [string, string, string] | [null, null, null] {
  /*
  Try to find the remember me token.
  If found associate current session with user and regenerate session id (this is important)
  If something fails or user isn't found we remove possible user id from session and continue
   */
  const [lookup, token, uuidBase64] = authCookie.split(';', 3);
  if (!uuidBase64) {
    return [null, null, null];
  }

  const uuid = Buffer.from(uuidBase64, 'base64').toString('ascii');
  if (uuid.length < 32) {
    return [null, null, null];
  }
  return [lookup, token, uuid];
}

// eslint-disable-next-line arrow-body-style
export const checkAuth = (app: Express) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authCookie = req.cookies.auth;
    // We don't need to check authentication for resources generated by next.js
    if (req.session.userId || !authCookie) {
      return next();
    }

    if (userPromises.has(authCookie)) {
      authLogger.debug('Race condition prevention');
      userPromises.get(authCookie)!
        .then(userId => {
          if (userId) {
            req.session.userId = userId;
          }
        })
        .finally(next);
      return;
    }

    const p = new Promise<number | undefined>((resolve, reject) => {
      bruteforce.prevent(req, res, () => {
        authLogger.debug('Checking auth from db for %s %s', req.originalUrl, req.cookies.auth);
        const [lookup, token, uuid] = parseAuthCookie(req.cookies.auth);
        if (!token) {
          res.clearCookie('auth');
          req.session.userId = undefined;
          resolve(undefined);
          next();
          return;
        }

        getUserByToken(lookup, token, uuid)
          .then(row => {
            if (!row) {
              sessionLogger.info('Session not found. Clearing cookie');
              res.clearCookie('auth');
              req.session.userId = undefined;
              resolve(undefined);

              db.oneOrNone<{ userId: number }>`SELECT u.user_id FROM auth_tokens 
                                   INNER JOIN users u ON auth_tokens.user_id = u.user_id 
                                   WHERE user_uuid=${uuid} AND lookup=${lookup}`
                .then(innerRow => {
                  if (!innerRow) return next();
                  // TODO Display warning
                  clearUserAuthTokens(innerRow.userId)
                    .finally(() => {
                      app.sessionStore.clearUserSessions(innerRow.userId, () => {
                        sessionLogger.info('Invalid auth token found for user. Sessions cleared');
                        next();
                      });
                    });
                })
                .catch(next);
              return;
            }

            userCache.set(row.userId, {
              userId: row.userId,
              username: row.username,
              uuid: row.userUuid,
              theme: row.theme,
              admin: row.admin,
            });
            // Try to regen session
            req.session.regenerate((err) => {
              if (err) {
                req.session.userId = undefined;
                reject(err);
                return next(err);
              }
              regenerateAuthToken(row.userId, lookup, uuid, (regenErr, newToken, expiresAt) => {
                if (regenErr || !newToken) {
                  console.error('Failed to regenerate/change token', regenErr);
                  reject(regenErr);
                  return next(regenErr);
                }
                authLogger.debug('regen %s', newToken);

                req.session.userId = row.userId;
                res.cookie('auth', newToken, {
                  httpOnly: true,
                  secure: !dev,
                  sameSite: 'lax',
                  expires: expiresAt,
                });
                resolve(row.userId);
                return next();
              });
            });
          })
          .catch(err => {
            resolve(undefined);
            req.session.userId = undefined;
            res.clearCookie('auth');
            if (err.code === '22P02') {
              res.status(400).end();
              return;
            }
            authLogger.error(err);
            next(err);
          });
      });
    });
    userPromises.set(authCookie, p);
    p.finally(() => {
      authLogger.debug('Deleting promise');
      userPromises.delete(authCookie);
    });
  };
};

export function clearUserAuthToken(uid: number, auth: string, cb: (err: null | any) => any) {
  const [lookup, token] = auth.split(';', 3);

  return db.sql`DELETE FROM auth_tokens WHERE user_id=${uid} AND lookup=${lookup} AND hashed_token=encode(digest(${token}, 'sha256'), 'hex')`
    .execute()
    .then(() => cb(null))
    .catch(err => cb(err));
}

export const modifyCacheUser = (uid: number, modifications: PartialExcept<SessionUser, 'userId'>) => {
  const user = userCache.get(uid);
  if (!user) return;
  userCache.set(uid, { ...user, ...modifications });
};

export const clearUserCache = () => {
  userCache.clear();
};
