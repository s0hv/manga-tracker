const dblog = require('debug')('db');
const { body } = require('express-validator');

const { requiresUser } = require('../db/auth');
const db = require('../db');
const { validateAdminUser, hadValidationError } = require('../utils/validators');
const { getChapterReleases } = require('../db/chapter');
const { generateEqualsColumns, handleError } = require('../db/utils');


const BASE_URL = '/api/chapter';

module.exports = app => {
  app.post(`${BASE_URL}/:chapter_id(\\d+)`, requiresUser, [
    validateAdminUser(),
    body('title').isString().optional(),
    body('chapter_number').isInt().optional(),
    body('chapter_decimal').isInt().optional({ nullable: true }),
    body('group').isString().optional(),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;


    if (!req.body || Object.keys(req.body).length === 0) {
      res.status(400).json({ error: 'Empty body' });
      return;
    }

    const editableColumns = [
      'title',
      'chapter_number',
      'chapter_decimal',
      'group',
    ];

    const { sqlCols, args } = generateEqualsColumns(req.body, editableColumns);
    if (args.length === 0) {
      res.status(400).json({ error: 'No valid values given' });
      return;
    }

    const chapterId = Number(req.params.chapter_id);
    args.push(chapterId);

    const sql = `UPDATE chapters SET ${sqlCols} WHERE chapter_id=$${args.length}`;
    dblog(`Updating chapter ${chapterId} with data`, req.body);

    db.query(sql, args)
      .then(r => {
        if (r.rowCount > 0) {
          res.status(200).json({ message: `Successfully updated ${r.rowCount} row(s)` });
        } else {
          res.status(404).json({ error: `Chapter with id ${chapterId} not found` });
        }
      })
      .catch(err => handleError(err, res));
  });

  app.delete(`${BASE_URL}/:chapter_id(\\d+)`, requiresUser, [
    validateAdminUser(),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    const sql = 'DELETE FROM chapters WHERE chapter_id=$1 RETURNING chapter_identifier, service_id';
    db.query(sql, [Number(req.params.chapter_id)])
      .then(r => {
        if (r.rowCount > 0) {
          const row = r.rows[0];
          dblog(`Deleted chapter from service ${row.service_id} and identifier ${row.chapter_identifier}`);
          res.status(200).json({ message: `Successfully deleted ${r.rowCount} row(s)` });
        } else {
          res.status(404).json({ error: `Chapter with id ${req.params.chapter_id} not found` });
        }
      })
      .catch(err => {
        handleError(err, res);
      });
  });

  app.get(`${BASE_URL}/releases/:manga_id(\\d+)`, (req, res) => {
    const mangaId = Number(req.params.manga_id);
    if (Number.isNaN(mangaId)) {
      res.status(400).json({ error: 'Invalid manga id given' });
      return;
    }

    getChapterReleases(mangaId)
      .then(rows => res.status(200).json(rows))
      .catch(err => handleError(err, res));
  });
};
