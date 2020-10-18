const { query } = require('express-validator');

const db = require('../db');
const { hadValidationError } = require('../utils/validators');
const { handleError } = require('../db/utils');
const { getManga } = require('../db/manga');

const searchQueryValidation = query('query')
  .isString()
  .withMessage('No search query specified')
  .bail()
  .isLength({ min: 2, max: 500 })
  .withMessage('Query must be between 2 and 500 characters');

function search(keywords, limit) {
  const sql = `WITH tmp as (
              (
                  SELECT m.manga_id, m.title, true as main, title <-> $1 as similarity
                  FROM manga m
                  WHERE REPLACE(m.title, '-', ' ') ILIKE '%' || $1 || '%'
                  ORDER BY m.title ILIKE $1 || '%' DESC, 4 -- 4th column in the select
                  LIMIT $2)
                  UNION (
                      SELECT ma.manga_id, m.title, false as main, ma.title <-> $1 as similarity
                      FROM manga_alias ma
                      INNER JOIN manga m ON m.manga_id = ma.manga_id
                      WHERE REPLACE(ma.title, '-', ' ') ILIKE '%' || $1 || '%'
                      ORDER BY ma.title ILIKE $1 || '%' DESC, 4 -- 4th column in the select
                      LIMIT $2)
                  ORDER BY main DESC
              )
              SELECT tmp2.manga_id, tmp2.title FROM (
                  SELECT DISTINCT ON(tmp.manga_id) tmp.manga_id, tmp.title, tmp.similarity FROM tmp) as tmp2
              ORDER BY tmp2.similarity`;

  return db.query(sql, [keywords.replace('-', ' '), limit]);
}

function mangaSearch(keywords) {
  const sql = `WITH tmp as (
                (SELECT m.manga_id, m.title, true as main
                FROM manga m
                WHERE REPLACE(m.title, '-', ' ') ILIKE '%' || $1 || '%'
                ORDER BY m.title ILIKE $1 || '%' DESC, title <-> $1
                LIMIT 1)
                UNION (
                    SELECT ma.manga_id, ma.title, false as main
                    FROM manga_alias ma
                    WHERE REPLACE(ma.title, '-', ' ') ILIKE '%' || $1 || '%'
                    ORDER BY ma.title ILIKE $1 || '%' DESC, title <-> $1
                    LIMIT 1)
                )
                SELECT *, manga.manga_id FROM manga LEFT JOIN manga_info mi ON manga.manga_id = mi.manga_id
                WHERE manga.manga_id=(SELECT manga_id FROM tmp ORDER BY main LIMIT 1)`;

  return db.query(sql, [keywords.replace('-', ' ')]);
}

function quickSearch(searchWords) {
  return search(searchWords, 5)
    .then(res => res.rows);
}

module.exports = app => {
  app.get('/api/quicksearch', [
    searchQueryValidation,
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    quickSearch(req.query.query)
      .then((results) => {
        res.json(results || []);
      })
      .catch(err => handleError(err, res));
  });

  app.get('/api/search', [
    searchQueryValidation,
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    mangaSearch(req.query.query)
      .then(rows => {
        if (rows.rowCount === 0) {
          return res.json({ manga: null });
        }
        const row = rows.rows[0];
        res.json({ manga: row });
        if ((!row.last_updated || (Date.now() - row.last_updated)/8.64E7 > 7)) {
          getManga(row.manga_id, 50)
            .catch(console.error);
        }
      })
      .catch(err => handleError(err, res));
  });
};
