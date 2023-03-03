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
        // Force refetch afater update
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
};
