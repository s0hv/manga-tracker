import type { Express } from 'express-serve-static-core';
import { z } from 'zod';

import { db } from '#server/db/helpers';
import { removeUserFromCache } from '#server/db/user';
import { handleError } from '#server/db/utils';
import {
  validateRequest,
  validateUser2,
} from '#server/utils/validators';
import { Theme } from '@/types/dbTypes';


export default (app: Express) => {
  app.post('/api/settings/theme',
    ...validateRequest({
      query: z.object({ value: Theme }),
    }, validateUser2),
    (req, res) => {
      const { userId } = req.getUser();
      db.sql`UPDATE users SET theme=${req.query.value}::theme WHERE user_id=${userId}`
        .execute()
        .then(() => {
          removeUserFromCache(userId);
          res.status(200).end();
        })
        .catch(err => handleError(err, res));
    });
};
