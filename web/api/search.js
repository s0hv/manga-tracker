const pool = require('../db');

module.exports.quickSearch = function (searchWords, cb) {
    if (searchWords.length < 3) return cb(null);
    const sql = `WITH tmp as (
                 (SELECT m.manga_id, m.title, true as main
                 FROM manga m
                 WHERE m.title ILIKE '%' || $1 || '%'
                 ORDER BY m.title ILIKE $1 || '%' DESC, title <-> $1
                 LIMIT 5)
                 UNION (
                     SELECT ma.manga_id, ma.title, false as main
                     FROM manga_alias ma
                     WHERE ma.title ILIKE '%' || $1 || '%'
                     ORDER BY ma.title ILIKE $1 || '%' DESC, title <-> $1
                     LIMIT 5)
                 ORDER BY main DESC)
                 SELECT DISTINCT ON(tmp.manga_id) tmp.manga_id, tmp.title FROM tmp`

    pool.query(sql, [searchWords])
        .then(res => cb(res.rows))
        .catch(err => {
            console.log(err);
            cb(null);
        });
}