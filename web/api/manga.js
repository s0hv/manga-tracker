const { query } = require('express-validator');

const { db } = require('../db');
const { handleError } = require('../db/utils');
const { getChapters } = require('../db/chapter');
const { getOptionalNumberParam } = require('../utils/utilities');
const {
  mangaIdValidation,
  hadValidationError,
  validateAdminUser,
  databaseIdValidation,
  limitValidation,
} = require('../utils/validators');
const { requiresUser } = require('../db/auth');
const { getFullManga } = require('../db/manga');

const BASE_URL = '/api/manga';

module.exports = app => {
  app.post('/api/manga/merge', requiresUser, [
    validateAdminUser(),
    databaseIdValidation('base'),
    databaseIdValidation('to_merge'),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    if (req.query.base === req.query.to_merge) {
      res.status(400).json({ error: 'Given ids are equal' });
      return;
    }

    const sql = 'SELECT * FROM merge_manga($1, $2)';
    db.oneOrNone(sql, [req.query.base, req.query.to_merge])
      .then(row => {
        if (!row) {
          return res.status(500).json({ error: 'No modifications done' });
        }
        res.status(200).json(row);
      })
      .catch(err => handleError(err, res));
  });

  /**
   * @openapi
   * /manga/{mangaId}:
   *   get:
   *     summary: Returns information about a single manga
   *     description: Welcome to swagger-jsdoc!
   *     parameters:
   *       - name: mangaId
   *         in: path
   *         required: true
   *         description: Id of the manga
   *         schema:
   *           $ref: '#/components/schemas/databaseId'
   *
   *       - name: chapters
   *         in: query
   *         required: false
   *         description: How many chapters to include
   *         schema:
   *           type: integer
   *           minimum: 0
   *           maximum: 50
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
  app.get('/api/manga/:manga_id', [
    mangaIdValidation(true),
    limitValidation('chapters', false, 'Amount of chapters must be a positive integer')
      .bail()
      .isInt({ max: 50 })
      .withMessage('Chapter amount must be 50 or less')
      .optional(),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    getFullManga(req.params.manga_id, req.query.chapters)
      .then(manga => {
        if (!manga) {
          res.status(404).json({ error: 'Manga not found' });
          return;
        }
        res.json({ data: manga });
      })
      .catch(err => handleError(err, res));
  });

  app.get(`${BASE_URL}/:manga_id(\\d+)/chapters`, [
    mangaIdValidation(true),
    query('limit').isInt({ min: 0, max: 200 }).optional().withMessage('Limit must be an integer between 0 and 200'),
    query('offset').isInt({ min: 0 }).optional().withMessage('Offset must be a positive integer'),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    const mangaId = Number(req.params.manga_id);
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

    getChapters(mangaId, limit, offset)
      .then(rows => {
        if (!rows) {
          res.status(404).json({ error: 'No manga found with given id' });
          return;
        }
        res.json(rows);
      })
      .catch(err => handleError(err, res));
  });
};
