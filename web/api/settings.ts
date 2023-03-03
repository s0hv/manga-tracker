import type { Express, Request, Response } from 'express-serve-static-core';
import {
  handleValidationErrors,
  positiveTinyInt,
  validateUser,
} from '../utils/validators';
import { db } from '@/db/helpers';
import { handleError } from '@/db/utils';


export default (app: Express) => {
  app.post('/api/settings/theme', [
    validateUser(),
    positiveTinyInt('value'),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    const val = Number(req.query.value);

    db.sql`UPDATE users SET theme=${val} WHERE user_id=${req.user!.userId}`
      .execute()
      .then(() => {
        app.sessionStore.deleteUserFromCache(req.user!.id);
        res.status(200).end();
      })
      .catch(err => handleError(err, res));
  });
};
