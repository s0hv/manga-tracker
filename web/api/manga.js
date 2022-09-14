import { query, param } from 'express-validator';

import { db } from '@/db/helpers';
import { handleError } from '@/db/utils';
import { getChapters } from '@/db/chapter';
import { getOptionalNumberParam } from '../utils/utilities.js';
import {
  mangaIdValidation,
  hadValidationError,
  validateAdminUser,
  databaseIdValidation,
  handleValidationErrors,
} from '../utils/validators.js';
import { requiresUser } from '@/db/auth';
import { getFullManga, getMangaForElastic } from '@/db/manga';
import { updateManga, deleteManga } from '@/db/elasticsearch/manga';
import { dbLogger } from '../utils/logging.js';

const BASE_URL = '/api/manga';

export default app => {
  app.post('/api/manga/merge', requiresUser, [
    validateAdminUser(),
    databaseIdValidation(query('base')),
    databaseIdValidation(query('toMerge')),
    databaseIdValidation(query('service')).optional(),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    if (req.query.base === req.query.toMerge) {
      res.status(400).json({ error: 'Given ids are equal' });
      return;
    }

    return db.oneOrNone`SELECT * FROM merge_manga(${req.query.base}, ${req.query.toMerge}, ${req.query.service || null})`
      .then(row => {
        if (!row) {
          return res.status(500).json({ error: 'No modifications done' });
        }

        // Delete old manga only if full merge
        if (!req.query.service) {
          deleteManga(req.query.toMerge)
            .then(() => dbLogger.info('Deleted manga %s from elasticsearch', req.query.toMerge))
            .catch(err => dbLogger.error(err, 'Failed to delete manga from elasticsearch'));
        } else {
          getMangaForElastic(req.query.toMerge)
            .then(manga => updateManga(manga.mangaId, manga))
            .catch(err => dbLogger.error(err, 'Failed to update merged manga to elasticsearch'));
        }

        return getMangaForElastic(req.query.base)
          .then(manga => updateManga(manga.mangaId, manga)
            .catch(err => dbLogger.error(err, 'Failed to update elasticsearch')))
          .finally(() => res.status(200).json(row));
      })
      .catch(err => handleError(err, res));
  });

  /**
   * @openapi
   * /manga/{mangaId}:
   *   get:
   *     summary: Get manga
   *     description: Get information about a manga
   *     parameters:
   *       - name: mangaId
   *         in: path
   *         required: true
   *         description: Id of the manga
   *         schema:
   *           $ref: '#/components/schemas/databaseId'
   *
   *     responses:
   *       200:
   *         description: Returns a JSON containing information about the manga
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/fullManga'
   *               required:
   *                 - data
   *       400:
   *         $ref: '#/components/responses/validationError'
   *       404:
   *         $ref: '#/components/responses/notFound'
   */
  app.get('/api/manga/:mangaId', [
    mangaIdValidation(param('mangaId')),
    handleValidationErrors,
  ], (req, res) => {
    getFullManga(req.params.mangaId)
      .then(manga => {
        if (!manga) {
          res.status(404).json({ error: 'Manga not found' });
          return;
        }
        res.json({ data: manga });
      })
      .catch(err => handleError(err, res));
  });

  /**
   *  @openapi
   *  /manga/{mangaId}/chapters:
   *    get:
   *      summary: Get chapters
   *      description: >
   *        Get the chapters of a manga. Results are sorted by the release date
   *        in descending order.
   *      parameters:
   *        - name: mangaId
   *          in: path
   *          required: true
   *          description: Id of the manga
   *          schema:
   *            $ref: '#/components/schemas/databaseId'
   *
   *        - name: limit
   *          in: query
   *          required: false
   *          description: Amount of chapters to fetch.
   *          schema:
   *            type: integer
   *            minimum: 0
   *            maximum: 200
   *            default: 50
   *
   *        - name: offset
   *          in: query
   *          required: false
   *          description: Offset used when fetching.
   *          schema:
   *            type: integer
   *            minimum: 0
   *            default: 0
   *
   *        - name: sortBy
   *          in: query
   *          required: false
   *          description: The column used for sorting.
   *          schema:
   *            type: string
   *            enum: ['chapter_number', 'group', 'chapter_id', 'release_date']
   *
   *        - name: sort
   *          in: query
   *          required: false
   *          description: The sorting direction.
   *          schema:
   *            type: string
   *            enum: ['asc', 'desc']
   *
   *      responses:
   *        200:
   *          description: Returns a list of chapters and the amount of all chapters
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  data:
   *                    type: object
   *                    properties:
   *                      count:
   *                        type: integer
   *                        minimum: 0
   *                      chapters:
   *                        type: array
   *                        items:
   *                          $ref: '#/components/schemas/chapter'
   *
   *                    required:
   *                      - count
   *                      - chapters
   *
   *                required:
   *                  - data
   *        400:
   *          $ref: '#/components/responses/validationError'
   *        404:
   *          $ref: '#/components/responses/notFound'
   */
  app.get(`${BASE_URL}/:mangaId(\\d+)/chapters`, [
    mangaIdValidation(param('mangaId')),
    query('limit').isInt({ min: 0, max: 200 }).optional().withMessage('Limit must be an integer between 0 and 200'),
    query('offset').isInt({ min: 0 }).optional().withMessage('Offset must be a positive integer'),
    query('sortBy')
      .isString()
      .optional()
      .bail()
      .toLowerCase()
      .isIn(['chapter_id', 'chapter_number', 'release_date', 'group'])
      .withMessage('Sort column must be one of "chapter_id", "chapter_number", "release_date", "group"'),
    query('sort')
      .isString()
      .optional()
      .bail()
      .toLowerCase()
      .isIn(['asc', 'desc'])
      .withMessage('Sorting direction must be one of "asc" or "desc"'),
    handleValidationErrors,
  ], (req, res) => {
    const mangaId = Number(req.params.mangaId);
    let limit;
    let offset;

    try {
      limit = getOptionalNumberParam(req.query.limit, 50);
      offset = getOptionalNumberParam(req.query.offset, 0);
    } catch (err) {
      if (err instanceof TypeError) {
        res.status(400).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
      return;
    }

    const sortBy = [];
    const isDesc = req.query.sort === 'desc';

    if (req.query.sortBy === 'chapter_number') {
      sortBy.push({
        col: 'chapter_number',
        desc: isDesc,
      });
      sortBy.push({
        col: 'chapter_decimal',
        desc: isDesc,
        nullsLast: isDesc,
      });
    } else if (req.query.sortBy) {
      sortBy.push({
        col: req.query.sortBy,
        desc: isDesc,
        nullsLast: isDesc,
      });
    }

    getChapters(mangaId, limit, offset, sortBy)
      .then(rows => {
        if (!rows) {
          res.status(404).json({ error: 'No manga found with given id' });
          return;
        }
        res.json({ data: rows });
      })
      .catch(err => handleError(err, res));
  });
};
