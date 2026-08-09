import express from 'express';
import type { Application } from 'express-serve-static-core';
import * as z from 'zod';

import {
  coercedIntStr,
  databaseIdStr,
  validateAdminUser,
  validateRequest,
} from '#server/utils/validators';
import { DbChapterCreate } from '@/common/schemas/chapter';
import { isoDatetimeToDate } from '@/common/schemas/common';
import {
  deleteChapterFail,
  fixFailedChapter,
  getChapterFails,
} from '@/db/chapterFail';
import { handleError } from '@/db/utils';

export const router = express.Router();

router.use(validateAdminUser);

router.get('/',
  validateRequest({
    query: z.object({
      limit: z.optional(coercedIntStr.pipe(
        z.int()
          .min(0)
          .max(200)
      )).default(50),
      offset: z.optional(coercedIntStr.pipe(
        z.int().min(0)
      )).default(0),
    }),
  }),
  (req, res) => {
    const {
      limit,
      offset,
    } = req.query;

    getChapterFails(limit, offset)
      .then(chaptersFailed => res.json({ data: chaptersFailed }))
      .catch(err => handleError(err, res));
  });

router.post('/fix',
  validateRequest({
    body: DbChapterCreate
      .extend({
        releaseDate: isoDatetimeToDate,
      }),
  }),
  (req, res) => {
    fixFailedChapter(req.body)
      .then(() => res.json({ status: 'OK' }))
      .catch(err => handleError(err, res));
  });

router.delete('/:serviceId/:chapterIdentifier',
  validateRequest({
    params: z.strictObject({
      serviceId: databaseIdStr,
      chapterIdentifier: z.string(),
    }),
  }),
  (req, res) => {
    const {
      serviceId,
      chapterIdentifier,
    } = req.params;

    deleteChapterFail(serviceId, chapterIdentifier)
      .then(count => {
        if (count === 0) {
          return res.sendStatus(404);
        }

        return res.json({ status: 'OK' });
      })
      .catch(err => handleError(err, res));
  });

export default (app: Application) => {
  app.use('/api/admin/chapters-failed', router);
};
