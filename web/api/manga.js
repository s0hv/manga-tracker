const { query } = require('express-validator');

const db = require('../db');
const { insertFollow, deleteFollow } = require('../db/follows');
const { handleError } = require('../db/utils');
const { getChapters } = require('../db/chapter');
const { getOptionalNumberParam } = require('../utils/utilities');
const {
  mangaIdValidation,
  serviceIdValidation,
  hadValidationError,
  validateUser,
  validateAdminUser,
  databaseIdValidation,
  limitValidation,
} = require('../utils/validators');
const { requiresUser } = require('../db/auth');
const { getManga } = require('../db/manga');

const BASE_URL = '/api/manga';

module.exports = app => {
  app.get('/api/manga/:manga_id(\\d+)', [
    mangaIdValidation(true),
    limitValidation('chapters', false, 'Amount of chapters must be a positive integer').optional(),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    getManga(req.params.manga_id, req.query.chapters)
      .then(rows => {
        if (!rows) {
          res.status(404).json({ error: 'Manga not found' });
          return;
        }
        res.json({ manga: rows });
      })
      .catch(err => handleError(err, res));
  });

  app.put('/api/user/follows', requiresUser, [
    mangaIdValidation(),
    serviceIdValidation().optional(),
    validateUser(),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    insertFollow(req.user.user_id, req.query.manga_id, req.query.service_id)
      .then(() => res.status(200).end())
      .catch(err => handleError(err, res));
  });

  app.delete('/api/user/follows', requiresUser, [
    mangaIdValidation(),
    serviceIdValidation().optional(),
    validateUser(),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    deleteFollow(req.user.user_id, req.query.manga_id, req.query.service_id)
      .then(rows => {
        if (rows.rowCount === 0) return res.status(404).end();
        res.status(200).end();
      })
      .catch(err => handleError(err, res));
  });

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
    db.query(sql, [req.query.base, req.query.to_merge])
      .then(rows => {
        if (rows.rowCount === 0) {
          return res.status(500).json({ error: 'No modifications done' });
        }
        res.status(200).json(rows.rows[0]);
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
