import { body } from 'express-validator';
import { UNIQUE_VIOLATION } from 'pg-error-constants';
import type { Express, Request, Response } from 'express-serve-static-core';

import { sessionLogger, userLogger } from '../utils/logging.js';


import { deleteFollow, insertFollow } from '@/db/follows';
import { handleError } from '@/db/utils';
import {
  hadValidationError,
  mangaIdValidation,
  newPassword,
  passwordRequired,
  serviceIdValidation,
  validateUser,
} from '../utils/validators.js';
import {
  clearUserAuthToken,
  clearUserAuthTokens,
  generateAuthToken,
  requiresUser,
} from '@/db/auth';
import { db } from '@/db/helpers';
import { regenerateSession } from '../utils/utilities.js';
import type { DatabaseId, MangaId } from '@/types/dbTypes';

const dev = process.env.NODE_ENV !== 'production';


const MAX_USERNAME_LENGTH = 100;

export default (app: Express) => {
  app.post('/api/profile', requiresUser, [
    validateUser(),
    newPassword('newPassword', 'repeatPassword'),
    body('email')
      .if(body('email').exists())
      .isEmail()
      .custom(passwordRequired),
    body('username')
      .isString()
      .optional()
      .bail()
      .isLength({ max: MAX_USERNAME_LENGTH })
      .withMessage(`Max username length is ${MAX_USERNAME_LENGTH}`)
      .optional(),
  ], (req: Request, res: Response) => {
    if (hadValidationError(req, res)) return;

    const cols = [];
    const {
      newPassword: newPass,
      email,
      username,
      password,
    } = req.body;
    let pw = false;

    if (newPass) {
      pw = true;
      cols.push(db.sql`pwhash=crypt(${newPass}, gen_salt('bf'))`);
    }

    if (email) {
      cols.push(db.sql`email=${email}`);
      pw = true;
    }

    if (username) {
      cols.push(db.sql`username=${username}`);
    }

    if (cols.length === 0) {
      res.status(400).json({ error: 'Nothing to change' });
      return;
    }

    const pwCheck = db.sql` AND pwhash=crypt(${password}, pwhash)`;
    db.sql`UPDATE users
                 SET ${cols.reduce((acc, col) => db.sql`${acc}, ${col}`)}
                 WHERE user_id=${req.user!.userId} ${pw ? pwCheck : db.sql``}`
      .then(rows => {
        if (rows.count === 0) {
          res.status(401).json({ error: 'Invalid password' });
          return;
        }

        if (pw) {
          app.sessionStore.clearUserSessions(req.user!.userId, (err) => {
            if (err) {
              return res.status(500).json({ error: 'Internal server error' });
            }

            clearUserAuthTokens(req.user!.userId)
              .then(() => {
                if (!req.cookies.auth) {
                  regenerateSession(req)
                    .catch(sessionLogger.error)
                    .finally(() => res.status(200).end());
                  return;
                }

                generateAuthToken(req.user!.userId, req.user!.uuid)
                  .then(token => {
                    res.cookie('auth', token, {
                      maxAge: 2592000000, // 30d in ms
                      secure: !dev,
                      httpOnly: true,
                      sameSite: 'lax',
                    });
                    regenerateSession(req)
                      .catch(sessionLogger.error)
                      .finally(() => res.status(200).end());
                  })
                  .catch(genErr => {
                    console.error(genErr);
                    res.status(500).json({ error: 'Internal server error' });
                  });
              })
              .catch(clearErr => {
                console.error(clearErr);
                res.status(500).json({ error: 'Internal server error' });
              });
          });
        } else {
          res.json({ message: 'success' });
        }
      })
      .catch(err => handleError(
        err,
        res,
        { [UNIQUE_VIOLATION]: 'Email is already in use' }
      ));
  });

  app.post('/api/logout', requiresUser, (req: Request, res: Response) => {
    if (!req.user?.userId) return res.redirect('/');

    userLogger.debug('Logging out user %s', req.user.userId);

    req.session.destroy((err) => {
      if (err) console.error(err);
      res.clearCookie('sess');
      if (req.cookies.auth) {
        clearUserAuthToken(req.user!.userId, req.cookies.auth, () => {
          res.clearCookie('auth');
          res.redirect('/');
        });
        return;
      }

      res.redirect('/');
    });
  });

  app.put('/api/user/follows', requiresUser, [
    mangaIdValidation(),
    serviceIdValidation().optional(),
    validateUser(),
  ], (req: Request, res: Response) => {
    if (hadValidationError(req, res)) return;

    insertFollow(req.user!.userId, req.query.mangaId as MangaId, req.query.serviceId as DatabaseId)
      .then(() => res.status(200).end())
      .catch(err => handleError(err, res));
  });

  app.delete('/api/user/follows', requiresUser, [
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
