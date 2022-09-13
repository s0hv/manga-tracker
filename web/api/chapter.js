import { body as validateBody, query } from 'express-validator';

import { NoColumnsError } from '@/db/errors';
import { requiresUser } from '@/db/auth';
import {
  editChapter,
  deleteChapter,
  getChapterReleases,
  getLatestChapters,
} from '@/db/chapter';
import {
  validateAdminUser,
  handleValidationErrors,
} from '../utils/validators.js';
import { handleError } from '@/db/utils';
import { dbLogger } from '../utils/logging.js';


const BASE_URL = '/api/chapter';

export default app => {
  app.post(`${BASE_URL}/:chapterId(\\d+)`, requiresUser, [
    validateAdminUser(),
    validateBody('title').isString().optional(),
    validateBody('chapterNumber').isInt().optional(),
    validateBody('chapterDecimal').isInt().optional({ nullable: true }),
    validateBody('group').isString().optional(),
    handleValidationErrors,
  ], (req, res) => {
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

  app.delete(`${BASE_URL}/:chapterId(\\d+)`, requiresUser, [
    validateAdminUser(),
    handleValidationErrors,
  ], (req, res) => {
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

  app.get(`${BASE_URL}/releases/:mangaId(\\d+)`, (req, res) => {
    const mangaId = Number(req.params.mangaId);
    if (Number.isNaN(mangaId)) {
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
    handleValidationErrors,
  ], (req, res) => {
    getLatestChapters(req.query.limit, req.query.offset)
      .then(rows => res.status(200).json({ data: rows }))
      .catch(err => handleError(err, res));
  });
};
