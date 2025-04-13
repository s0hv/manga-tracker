import { body } from 'express-validator';
import type { Express, Request, Response } from 'express-serve-static-core';

import { deleteFollow, insertFollow } from '@/db/follows';
import { handleError } from '@/db/utils';
import {
  hadValidationError,
  handleValidationErrors,
  mangaIdValidation,
  newPassword,
  serviceIdValidation,
  validateUser,
} from '../utils/validators';
import { db } from '@/db/helpers';
import type { DatabaseId, MangaId } from '@/types/dbTypes';
import { getUserNotifications } from '@/db/notifications';


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

    const pwCheck = db.sql` AND pwhash IS NOT NULL AND pwhash=crypt(${password}, pwhash)`;
    db.sql`UPDATE users
                 SET ${cols.reduce((acc, col) => db.sql`${acc}, ${col}`)}
                 WHERE user_id=${req.user!.userId} ${pw ? pwCheck : db.sql``}`
      .then(rows => {
        if (rows.count === 0) {
          res.status(401).json({ error: 'Invalid password' });
          return;
        }
        // Force refetch after update
        app.sessionStore.deleteUserFromCache(req.user!.id);
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
  ], (req: Request, res: Response) => {
    db.any`UPDATE sessions SET delete_user=CURRENT_TIMESTAMP WHERE session_id=${req.session.sessionToken}`
      .then(() => {
        res.status(200).json({ message: 'Delete account by signing out within a minute' });
      })
      .catch(err => handleError(err, res));
  });

  app.post('/api/user/dataRequest', [
    validateUser(),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    const user = req.user!;

    Promise.all([
      getUserNotifications(user.userId),
      db.one`SELECT user_id, username, email, user_uuid, joined_at, theme, admin, email_verified, is_credentials_account, last_active FROM users WHERE user_id=${user.userId}`,
      db.any`SELECT id, type, provider, provider_account_id, expires_at, token_type, scope, user_id FROM account WHERE user_id=${user.uuid}`,
      db.any`
        SELECT uf.*, m.title, COALESCE(s.service_name, 'All services') as service_name FROM user_follows uf 
        INNER JOIN manga m ON uf.manga_id=m.manga_id
        LEFT JOIN services s ON uf.service_id = s.service_id
        WHERE user_id=${user.userId}`,
      db.any`SELECT * FROM sessions WHERE user_id=${user.uuid}`,
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
