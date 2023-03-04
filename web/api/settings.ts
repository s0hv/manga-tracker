import type { Express, Request, Response } from 'express-serve-static-core';
import { query } from 'express-validator';
import { handleValidationErrors, validateUser } from '../utils/validators';
import { db } from '@/db/helpers';
import { handleError } from '@/db/utils';
import type { Theme } from '@/types/dbTypes';


export default (app: Express) => {
  app.post('/api/settings/theme', [
    validateUser(),
    query('value')
      .isIn(['system', 'light', 'dark'] as Theme[]),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    db.sql`UPDATE users SET theme=${req.query.value as string}::theme WHERE user_id=${req.user!.userId}`
      .execute()
      .then(() => {
        app.sessionStore.deleteUserFromCache(req.user!.id);
        res.status(200).end();
      })
      .catch(err => handleError(err, res));
  });
};
