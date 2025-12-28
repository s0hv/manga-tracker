import type { Express, Request, Response } from 'express-serve-static-core';
import { query } from 'express-validator';

import { db } from '#server/db/helpers';
import { removeUserFromCache } from '#server/db/user';
import { handleError } from '#server/db/utils';
import { handleValidationErrors, validateUser } from '#server/utils/validators';
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
        removeUserFromCache(req.user!.userId);
        res.status(200).end();
      })
      .catch(err => handleError(err, res));
  });
};
