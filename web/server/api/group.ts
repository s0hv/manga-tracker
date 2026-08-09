import express from 'express';
import type { Application } from 'express-serve-static-core';
import * as z from 'zod';

import {
  coercedIntStr,
  validateAdminUser,
  validateRequest,
} from '#server/utils/validators';
import { searchGroups } from '@/db/group';
import { handleError } from '@/db/utils';

export const router = express.Router();

router.use(validateAdminUser);

router.get('/search',
  validateRequest({
    query: z.object({
      name: z.string().min(1),
      limit: z.optional(coercedIntStr.pipe(
        z.int()
          .min(1)
          .max(200)
      )).default(10),
    }),
  }),
  (req, res) => {
    const {
      limit,
      name,
    } = req.query;

    searchGroups(name, limit)
      .then(groups => res.json({ data: groups }))
      .catch(err => handleError(err, res));
  });

export default (app: Application) => {
  app.use('/api/groups', router);
};
