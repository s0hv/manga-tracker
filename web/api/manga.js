const pool = require('./../db');
const { requiresUser } = require('./../db/auth');
const { getManga } = require('./../db/manga');


module.exports = function (app) {
    app.get('/api/manga/:manga_id(\\d+)', (req, res) => {
        let limit = parseInt(req.query.chapters);
        getManga(req.params.manga_id, limit)
            .then()

        getManga(req.params.manga_id, limit, (err, rows) => {
            if (err) {
                res.json({
                    error: {
                        statusCode: err.status,
                        message: err.message,
                    }
                });
                return;
            }

            res.json({manga: rows});
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

    app.post('/api/manga/merge', requiresUser, (req, res) => {
        if (!req.user || !req.user.user_id.admin) {
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