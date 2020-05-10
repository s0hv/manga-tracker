const pool = require('./../db');
const { requiresUser } = require('./../db/auth');
const { fetchExtraInfo, formatLinks } = require('./../db/manga');

const MANGADEX_ID = 2; // Id of the mangadex service in the database


module.exports = function (app) {
    app.get('/api/manga/:manga_id(\\d+)', (req, res) => {
        const chapterSql = `(SELECT json_agg(ch) FROM 
                                (SELECT title, chapter_number, release_date, "group", service_id, chapter_identifier as chapter_url FROM chapters WHERE manga_id=$1 ORDER BY release_date DESC LIMIT $2) ch) 
                             as chapters,`
        let limit = parseInt(req.query.chapters)
        const args = [req.params.manga_id];

        if (limit <= 50 && limit > 0) {
            args.push(limit);
        } else {
            limit = false;
        }
        const sql = `SELECT manga.manga_id, title, release_interval, latest_release, estimated_release, manga.latest_chapter,
                            array_agg(json_build_object('title_id', ms.title_id, 'service_id', ms.service_id, 'name', s.service_name, 'url_format', chapter_url_format)) as services,
                            mi.cover, mi.status, mi.artist, mi.author,
                            mi.bw, mi.mu, mi.mal, mi.amz, mi.ebj, mi.engtl, mi.raw, mi.nu, mi.kt, mi.ap, mi.al,
                            ${limit ? chapterSql : ''} 
                            mi.manga_id IS NOT NULL as info_exists
                     FROM manga LEFT JOIN manga_info mi ON manga.manga_id = mi.manga_id
                                INNER JOIN manga_service ms ON manga.manga_id = ms.manga_id
                                INNER JOIN services s ON ms.service_id = s.service_id
                     WHERE manga.manga_id=$1
                     GROUP BY manga.manga_id, mi.manga_id`;

        pool.query(sql, args)
            .then(rows => {
                if (!(rows.rowCount > 0)) {
                    res.status(404).json({
                        status: 404,
                        error: 'Not found',
                    });
                    return;
                }
                const row = rows.rows[0];

                const mdIdx = row.services.findIndex(v => v.service_id === MANGADEX_ID);
                if (!row.info_exists && mdIdx >= 0) {
                    fetchExtraInfo(row.services[mdIdx].title_id, req.params.manga_id,
                        extra => {
                            formatLinks(extra);
                            res.json({...row, ...extra});
                        });
                    return;
                }

                formatLinks(row);
                res.json({
                    ...row
                });
            })
            .catch(err => {
                // integer overflow
                if (err.code === '22003' || err.code === '22P02') {
                    res.status(404).json({
                        status: 404,
                        error: 'Not found',
                    });
                    return;
                }
                console.error(err);
                res.status(500).json({
                    status: 500,
                    error: 'Internal server error'
                });
            })
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
        pool.query(sql, args)
            .then(rows => {
                if (rows.rowCount === 0) return res.status(404).end();
                res.status(200).end()
            })
            .catch(err => {
                if (err.code === '22003' || err.code === '22P02') {
                    res.status(400).end();
                    return;
                }
                res.status(500).end();
            })
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
        pool.query(sql, [req.query.manga_id, req.query.service_id, req.user.user_id])
            .then(res.status(200).end())
            .catch(err => {
                if (err.code === '22003' || err.code === '22P02') {
                    res.status(400).end();
                    return;
                }
                res.status(500).end();
            })
    });

    app.post('/api/manga/merge', requiresUser, (req, res) => {
        // TODO proper admin check
        if (!req.user || req.user.user_id !== 1) {
            res.status(401).end();
            return;
        }
        if (!req.query.base || !req.query.to_merge || req.query.base === req.query.to_merge) {
            res.status(400).json({error: 'Given ids were equal or not all ids were given'});
            return;
        }

        const sql = 'SELECT * FROM merge_manga($1, $2)';
        pool.query(sql, [req.query.base, req.query.to_merge])
            .then(rows => {
                if (rows.rowCount === 0) {
                    return res.status(400).json({error: 'No modifications done'})
                }
                res.status(200).json(rows.rows[0]);
            })
            .catch(err => {
                if (err.code === '22003' || err.code === '22P02') {
                    res.status(400).json({error: 'Failed to parse given ids'});
                    return;
                }

                res.status(500).json({error: 'Internal server error'});
            });
    })
}