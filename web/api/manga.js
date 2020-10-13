const db = require('../db');
const { handleError } = require('../db/utils');
const { getChapters } = require('../db/chapter');
const {
  getOptionalNumberParam,
  assertValuePositive,
  assertValueBetween,
} = require('../utils/utilities');
const { requiresUser } = require('../db/auth');
const { getManga } = require('../db/manga');

const BASE_URL = '/api/manga';

module.exports = app => {
  app.get('/api/manga/:manga_id(\\d+)', (req, res) => {
    const limit = parseInt(req.query.chapters);

    getManga(req.params.manga_id, limit, (err, rows) => {
      if (err) {
        res.json({
          error: {
            statusCode: err.status,
            message: err.message,
          },
        });
        return;
      }

      res.json({ manga: rows });
    });
  });

  app.put('/api/user/follows', requiresUser, (req, res) => {
    if (!req.user) {
      res.status(401).end();
      return;
    }
    if (!req.query.manga_id) {
      res.status(400).end();
      return;
    }
    const sql = 'INSERT INTO user_follows (manga_id, service_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING';
    db.query(sql, [req.query.manga_id, req.query.service_id, req.user.user_id])
      .then(res.status(200).end())
      .catch(err => {
        if (err.code === '22003' || err.code === '22P02') {
          res.status(400).end();
          return;
        }
        res.status(500).end();
      });
  });

  app.delete('/api/user/follows', requiresUser, (req, res) => {
    if (!req.user) {
      res.status(401).end();
      return;
    }
    if (!req.query.manga_id) {
      res.status(400).end();
      return;
    }

    const args = [req.user.user_id, req.query.manga_id];
    let service = 'service_id IS NULL';
    if (req.query.service_id) {
      args.push(req.query.service_id);
      service = 'service_id = $3';
    }
    const sql = `DELETE FROM user_follows WHERE user_id=$1 AND manga_id=$2 AND ${service}`;
    db.query(sql, args)
      .then(rows => {
        if (rows.rowCount === 0) return res.status(404).end();
        res.status(200).end();
      })
      .catch(err => {
        if (err.code === '22003' || err.code === '22P02') {
          res.status(400).end();
          return;
        }
        res.status(500).end();
      });
  });

  app.post('/api/manga/merge', requiresUser, (req, res) => {
    if (!req.user || !req.user.user_id.admin) {
      res.status(401).end();
      return;
    }
    if (!req.query.base || !req.query.to_merge || req.query.base === req.query.to_merge) {
      res.status(400).json({ error: 'Given ids were equal or not all ids were given' });
      return;
    }

    const sql = 'SELECT * FROM merge_manga($1, $2)';
    db.query(sql, [req.query.base, req.query.to_merge])
      .then(rows => {
        if (rows.rowCount === 0) {
          return res.status(400).json({ error: 'No modifications done' });
        }
        res.status(200).json(rows.rows[0]);
      })
      .catch(err => {
        if (err.code === '22003' || err.code === '22P02') {
          res.status(400).json({ error: 'Failed to parse given ids' });
          return;
        }

        res.status(500).json({ error: 'Internal server error' });
      });
  });

  app.get(`${BASE_URL}/:manga_id(\\d+)/chapters`, (req, res) => {
    const mangaId = Number(req.params.manga_id);
    if (!Number.isFinite(mangaId)) {
      res.status(400).json({ error: 'Invalid manga id given' });
      return;
    }

    let limit;
    let offset;

    try {
      limit = assertValueBetween(
        getOptionalNumberParam(req.query?.limit, 50, 'limit'),
        0,
        200,
        'limit'
      );
      offset = assertValuePositive(
        getOptionalNumberParam(req.query?.offset, 0, 'offset'),
        'offset'
      );
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
