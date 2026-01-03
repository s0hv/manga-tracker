import type { Express, Request, Response } from 'express-serve-static-core';
import { body } from 'express-validator';

import { clearUserAuthTokens, generateAuthToken } from '@/db/auth';
import { deleteFollow, insertFollow } from '@/db/follows';
import { db } from '@/db/helpers';
import { getUserNotifications } from '@/db/notifications';
import { clearUserSessions, createSession } from '@/db/session';
import { getUser, removeUserFromCache } from '@/db/user';
import { handleError } from '@/db/utils';
import {
  SECURE_COOKIE_OPTIONS,
  serverCookieNames,
} from '@/serverUtils/constants';
import {
  clearSecureCookie,
  setSessionCookie,
} from '@/serverUtils/requestHelpers';
import type { DatabaseId, MangaId } from '@/types/dbTypes';


import {
  hadValidationError,
  handleValidationErrors,
  mangaIdValidation,
  newPassword,
  serviceIdValidation,
  validateUser,
} from '../utils/validators';


const MAX_USERNAME_LENGTH = 100;

export default (app: Express) => {
  app.post('/api/profile', [
    validateUser(),
    newPassword('newPassword', 'repeatPassword'),
    body('username')
      .isString()
      .optional()
      .bail()
      .isLength({ max: MAX_USERNAME_LENGTH })
      .withMessage(`Max username length is ${MAX_USERNAME_LENGTH}`)
      .optional(),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    const cols = [];
    const {
      newPassword: newPass,
      username,
      password,
    } = req.body;
    let pw = false;

    if (newPass) {
      pw = true;
      cols.push(db.sql`pwhash=crypt(${newPass}, gen_salt('bf'))`);
    }

    if (username) {
      cols.push(db.sql`username=${username}`);
    }

    if (cols.length === 0) {
      res.status(400).json({ error: 'Nothing to change' });
      return;
    }

    const user = req.user!;
    const userId = user.userId;

    const pwCheck = db.sql` AND pwhash IS NOT NULL AND pwhash=crypt(${password}, pwhash)`;
    db.sql`UPDATE users
                 SET ${cols.reduce((acc, col) => db.sql`${acc}, ${col}`)}
                 WHERE user_id=${userId} ${pw ? pwCheck : db.sql``}`
      .then(async rows => {
        if (rows.count === 0) {
          res.status(401).json({ error: 'Invalid password' });
          return;
        }
        // Force refetching after an update
        removeUserFromCache(userId);

        // If the password was changed, invalidate all sessions
        // and generate a new auth token if one existed
        if (pw) {
          await clearUserSessions(userId);
          const session = await createSession(user.userId);
          setSessionCookie(session, res);

          if (req.signedCookies[serverCookieNames.authToken]) {
            await clearUserAuthTokens(userId);
            const { token, expiresAt } = await generateAuthToken(userId, user.userUuid);

            res.cookie(serverCookieNames.authToken, token, {
              ...SECURE_COOKIE_OPTIONS,
              expires: expiresAt,
            });
          }
        }

        res.json({ message: 'success' });
      })
      .catch(err => handleError(err, res));
  });

  app.put('/api/user/follows', [
    mangaIdValidation(),
    serviceIdValidation().optional(),
    validateUser(),
  ], (req: Request, res: Response) => {
    if (hadValidationError(req, res)) return;

    insertFollow(req.user!.userId, req.query.mangaId as MangaId, req.query.serviceId as DatabaseId)
      .then(() => res.status(200).end())
      .catch(err => handleError(err, res));
  });

  app.delete('/api/user/follows', [
    mangaIdValidation(),
    serviceIdValidation().optional(),
    validateUser(),
  ], (req: Request, res: Response) => {
    if (hadValidationError(req, res)) return;

    deleteFollow(req.user!.userId, req.query.mangaId as MangaId, req.query.serviceId as DatabaseId)
      .then(rows => {
        if (rows.count === 0) return res.status(404).end();
        res.status(200).end();
      })
      .catch(err => handleError(err, res));
  });

  app.post('/api/user/delete', [
    validateUser(),
    handleValidationErrors,
  ], async (req: Request, res: Response) => {
    const user = await getUser(req.user!.userId, { noCache: true });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // TODO validate that username matches

    removeUserFromCache(user.userId);
    await db.none`DELETE FROM users WHERE user_id=${user.userId}`;
    await clearUserSessions(user.userId);
    clearSecureCookie(res, serverCookieNames.authToken);
    clearSecureCookie(res, serverCookieNames.session);

    res.status(200).end();
  });

  app.post('/api/user/dataRequest', [
    validateUser(),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    const user = req.user!;

    Promise.all([
      getUserNotifications(user.userId),
      db.one`SELECT user_id, username, email, user_uuid, joined_at, theme, admin, last_active FROM users WHERE user_id=${user.userId}`,
      db.any`SELECT provider, provider_account_id, user_id FROM account WHERE user_id=${user.userId}`,
      db.any`
        SELECT uf.*, m.title, COALESCE(s.service_name, 'All services') as service_name FROM user_follows uf 
        INNER JOIN manga m ON uf.manga_id=m.manga_id
        LEFT JOIN services s ON uf.service_id = s.service_id
        WHERE user_id=${user.userId}`,
      db.any`SELECT expires_at, data FROM sessions WHERE user_id=${user.userId}`,
    ])
      .then(([notifications, userData, accounts, follows, sessions]) => {
        res.setHeader('Content-Disposition', 'attachment; filename="manga-tracker-user-data.json"');
        res
          .status(200)
          .json({
            notifications,
            user: userData,
            accounts,
            follows,
            sessions,
          });
      })
      .catch(err => handleError(err, res));
  });
};

export function updateUserLastActivity(userId: number) {
  return db.none`UPDATE users SET last_active=CURRENT_TIMESTAMP WHERE user_id=${userId}`;
}
