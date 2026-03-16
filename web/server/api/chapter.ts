import type { Express } from 'express-serve-static-core';
import * as z from 'zod';

import { dbLogger, expressLogger } from '#server/utils/logging';
import {
  booleanString,
  coercedIntStr,
  databaseIdStr,
  validateAdminUser,
  validateRequest,
  validateUser,
} from '#server/utils/validators';
import {
  deleteChapter,
  editChapter,
  getChapterReleases,
  getLatestChapters,
} from '@/db/chapter';
import { handleError } from '@/db/utils';


const BASE_URL = '/api/chapter';

export default (app: Express) => {
  app.post(`${BASE_URL}/:chapterId`,
    ...validateRequest({
      params: z.object({ chapterId: databaseIdStr }),
      body: z.strictObject({
        title: z.string().optional(),
        chapterNumber: z.int().optional(),
        chapterDecimal: z.int().nullable().optional(),
        group: z.string().optional(),
      }),
    },
    validateAdminUser),
    (req, res) => {
      const body = req.body;
      // z.strictObject will always strip keys with 'undefined' value
      if (!body || Object.keys(body).length === 0) {
        res.status(400).json({ error: 'Empty body' });
        return;
      }

      const chapterId = req.params.chapterId;

      expressLogger.info(`Updating chapter ${chapterId} with data %o`, body);

      const chapter = {
        chapterId,
        title: body.title,
        chapterNumber: body.chapterNumber,
        chapterDecimal: body.chapterDecimal,
      };

      editChapter(chapter)
        .then(r => {
          if (r.count > 0) {
            res.status(200).json({ message: `Successfully updated chapter ${chapterId}` });
          } else {
            res.status(404).json({ error: `Chapter with id ${chapterId} not found` });
          }
        })
        .catch(err => handleError(err, res));
    });

  app.delete(`${BASE_URL}/:chapterId`,
    ...validateRequest({
      params: z.object({ chapterId: databaseIdStr }),
    },
    validateAdminUser),
    (req, res) => {
      deleteChapter(req.params.chapterId)
        .then(row => {
          if (row) {
            dbLogger.info(`Deleted chapter from service ${row.serviceId} and identifier ${row.chapterIdentifier}`);
            res.status(200).json({ message: `Successfully deleted chapter ${row.chapterId}` });
          } else {
            res.status(404).json({ error: `Chapter with id ${req.params.chapterId} not found` });
          }
        })
        .catch(err => {
          handleError(err, res);
        });
    });

  app.get(`${BASE_URL}/releases/:mangaId`,
    validateRequest({
      params: z.object({ mangaId: databaseIdStr }),
    }), (req, res) => {
      getChapterReleases(req.params.mangaId)
        .then(rows => res.status(200).json(rows))
        .catch(err => handleError(err, res));
    });

  /**
   *  @openapi
   *  /chapter/latest:
   *    get:
   *      summary: Get a list of chapters sorted by release date
   *      responses:
   *        200:
   *          description: Returns the list of chapters
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  data:
   *                    type: array
   *                    items:
   *                      $ref: '#/components/schemas/chapterWithManga'
   *                required:
   *                  - data
   *        400:
   *          $ref: '#/components/responses/validationError'
   */
  app.get(`${BASE_URL}/latest`,
    validateRequest({
      query: z.object({
        limit: z.optional(coercedIntStr)
          .pipe(
            z.int('Limit must be between 0 and 50').min(0).max(50).optional()
          ).default(25),
        offset: z.optional(coercedIntStr)
          .pipe(z.int().min(0).max(500).optional()),
        useFollows: z.optional(booleanString),
      }),
    }),
    (req, res, next) => {
      if (req.query.useFollows) {
        validateUser(req, res, next);
      } else {
        next();
      }
    },
    (req, res) => {
      const data = req.query;
      getLatestChapters(data.limit, data.offset, data.useFollows ? req.getUser().userId : undefined)
        .then(rows => res.status(200).json({ data: rows }))
        .catch(err => handleError(err, res));
    });
};
