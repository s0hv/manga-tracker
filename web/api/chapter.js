const dblog = require('debug')('db');

const { requiresUser } = require('../db/auth');
const db = require('../db');
const { generateEqualsColumns, handleError } = require('../db/utils');

module.exports = app => {
  app.use('/api/chapter/:chapter_id(\\d+)', require('body-parser').json());
  app.post('/api/chapter/:chapter_id(\\d+)', requiresUser, (req, res) => {
    if (!req.user) {
      res.status(401).send({ error: 'Not logged in' });
      return;
    }
    if (!req.user.admin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

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
      .catch(err => {
        if (err.code === '22P02') {
          dblog(err.message);
          res.status(400).json({ error: 'Invalid data type given' });
          return;
        }

        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
      });
  });

  app.delete('/api/chapter/:chapter_id(\\d+)', requiresUser, (req, res) => {
    if (!req.user) {
      res.status(401).send({ error: 'Not logged in' });
      return;
    }
    if (!req.user.admin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

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
};
