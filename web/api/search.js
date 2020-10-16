const db = require('../db');
const { handleError } = require('../db/utils');
const { getManga } = require('../db/manga');

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

function quickSearch(searchWords, cb) {
  if (searchWords.length < 2) return cb(null);
  search(searchWords, 5)
    .then(res => cb(res.rows))
    .catch(err => {
      console.error(err);
      cb(null);
    });
}

module.exports = app => {
  app.get('/api/quicksearch', (req, res) => {
    if (!req.query.query) {
      return res.json([]);
    }

    quickSearch(req.query.query, (results) => {
      res.json(results || []);
    });
  });

  app.get('/api/search', (req, res) => {
    if (!req.query.query) {
      return res.json({ error: { status: 400, message: 'No search query specified' }});
    }

    if (req.query.query.length > 300) {
      return res.json({ error: { status: 400, message: 'Search query too long (over 300 characters). If manga names this long exist report this bug.' }});
    }

    mangaSearch(req.query.query)
      .then(rows => {
        if (rows.rowCount === 0) {
          return res.json({ manga: null });
        }
        const row = rows.rows[0];
        res.json({ manga: row });
        if ((!row.last_updated || (Date.now() - row.last_updated)/8.64E7 > 14)) {
          getManga(row.manga_id, 50)
            .catch(console.error);
        }
      })
      .catch(err => handleError(err, res));
  });
};
