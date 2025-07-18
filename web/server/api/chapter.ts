import type { Express, Request, Response } from 'express-serve-static-core';
import {
  body as validateBody,
  matchedData,
  param,
  query,
} from 'express-validator';

import {
  deleteChapter,
  editChapter,
  getChapterReleases,
  getLatestChapters,
} from '@/db/chapter';
import { NoColumnsError } from '@/db/errors';
import { handleError } from '@/db/utils';


import { dbLogger } from '../utils/logging';
import {
  databaseIdValidation,
  handleValidationErrors, mangaIdValidation,
  userValidator,
  validateAdminUser,
} from '../utils/validators';

const BASE_URL = '/api/chapter';

export default (app: Express) => {
  app.post(`${BASE_URL}/:chapterId`, [
    validateAdminUser(),
    databaseIdValidation(param('chapterId')),
    validateBody('title').isString().optional(),
    validateBody('chapterNumber').isInt().optional(),
    validateBody('chapterDecimal').isInt().optional({ nullable: true }),
    validateBody('group').isString().optional(),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      res.status(400).json({ error: 'Empty body' });
      return;
    }

    const chapterId = Number(req.params.chapterId);

    req.log.info(`Updating chapter ${chapterId} with data %o`, body);

    const chapter = {
      chapterId,
      title: body.title,
      chapterNumber: body.chapterNumber,
      chapterDecimal: body.chapterDecimal,
      group: body.group,
    };

    editChapter(chapter)
      .then(r => {
        if (r.count > 0) {
          res.status(200).json({ message: `Successfully updated chapter ${chapterId}` });
        } else {
          res.status(404).json({ error: `Chapter with id ${chapterId} not found` });
        }
      })
      .catch(err => {
        if (err instanceof NoColumnsError) {
          res.status(400).json({ error: 'No valid values given' });
          return;
        }
        handleError(err, res);
      });
  });

  app.delete(`${BASE_URL}/:chapterId`, [
    validateAdminUser(),
    databaseIdValidation(param('chapterId')),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    deleteChapter(Number(req.params.chapterId))
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

  app.get(`${BASE_URL}/releases/:mangaId`, [
    mangaIdValidation(param('mangaId')),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    const mangaId = Number(req.params.mangaId);
    if (Number.isNaN(mangaId) || !Number.isFinite(mangaId)) {
      res.status(400).json({ error: 'Invalid manga id given' });
      return;
    }

    getChapterReleases(mangaId)
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
  app.get(`${BASE_URL}/latest`, [
    query('limit').optional()
      .isInt({ max: 50, min: 0 })
      .default(25)
      .withMessage('Limit must be between 0 and 50'),
    query('offset').optional().isInt({ min: 0, max: 500 }),
    query('useFollows')
      .isBoolean()
      .bail()
      .optional()
      .toBoolean()
      .if(val => val === true)
      .custom(userValidator),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    const data = matchedData(req, { includeOptionals: false });
    getLatestChapters(data.limit, data.offset, data.useFollows ? req.user?.userId : undefined)
      .then(rows => res.status(200).json({ data: rows }))
      .catch(err => handleError(err, res));
  });
};
