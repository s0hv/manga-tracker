const pool = require('../db');

function search(keywords, limit) {
        const sql = `WITH tmp as (
                 (SELECT m.manga_id, m.title, true as main
                 FROM manga m
                 WHERE REPLACE(m.title, '-', ' ') ILIKE '%' || $1 || '%'
                 ORDER BY m.title ILIKE $1 || '%' DESC, title <-> $1
                 LIMIT $2)
                 UNION (
                     SELECT ma.manga_id, ma.title, false as main
                     FROM manga_alias ma
                     WHERE REPLACE(ma.title, '-', ' ') ILIKE '%' || $1 || '%'
                     ORDER BY ma.title ILIKE $1 || '%' DESC, title <-> $1
                     LIMIT $2)
                 ORDER BY main DESC)
                 SELECT DISTINCT ON(tmp.manga_id) tmp.manga_id, tmp.title FROM tmp`;

        return pool.query(sql, [keywords.replace('-', ' '), limit]);
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
                SELECT * FROM manga LEFT JOIN manga_info mi ON manga.manga_id = mi.manga_id
                WHERE manga.manga_id=(SELECT manga_id FROM tmp ORDER BY main LIMIT 1)`;

    return pool.query(sql, [keywords.replace('-', ' ')]);
}

function quickSearch(searchWords, cb) {
    if (searchWords.length < 3) return cb(null);
    search(searchWords, 5)
        .then(res => cb(res.rows))
        .catch(err => {
            console.error(err);
            cb(null);
        });
}

module.exports = function (app) {
    app.get('/api/quicksearch', (req, res) => {
        if (!req.query.query) {
            return res.json([]);
        }

        quickSearch(req.query.query, (results) => {
            res.json(results || []);
        })
    });

    app.get('/api/search', (req, res) => {
        if (!req.query.query) {
            return res.json({error: {status: 400, message: 'No search query specified'}});
        }

        if (req.query.query.length > 300) {
            return res.json({error: {status: 400, message: 'Search query too long (over 300 characters). If this long names exist report this bug.'}});
        }

        mangaSearch(req.query.query)
            .then(rows => {
                if (rows.rowCount === 0) {
                    return res.json({manga: null});
                }
                const row = rows.rows[0];
                res.json({manga: row});
            })
            .catch(err => {
                console.error(err);
                res.json({error: {status: 500, message: 'Internal server error. Try again later'}});
            })
    });
}