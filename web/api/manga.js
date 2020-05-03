const pool = require('./../db');
const { requiresUser } = require('./../db/auth');
const { Manga, Util, link: Link, Chapter, Group } = require("mangadex-full-api");
const MANGADEX_ID = 2; // Id of the mangadex service in the database

// Fill that only does an api request
Manga.prototype.apiFill = function (id) {
    const jsonAPI = "https://mangadex.org/api/manga/";

    if (!id) id = this.id;

    return new Promise((resolve, reject) => {
        if (!id) reject("No id specified or found.");
        Util.getJSON(jsonAPI + id.toString()).then((json) => {
            const origLinks = {...json.manga.links }
            this._parse({...json, id: id});
            this.links = origLinks; // override default behavior of adding prefixes
            resolve(this);
        }).catch(reject);
    });
}

Chapter.prototype._parseOld = Chapter.prototype._parse;
Chapter.prototype._parse = function(data) {
    this._parseOld(data);
    this.firstGroupName = data.group_name;
}

function fetchExtraInfo(mangadexId, mangaId, cb) {
    const manga = new Manga();
    console.info(`Fetching extra info for ${mangaId} ${mangadexId}`);
    manga.apiFill(mangadexId)
        .then(() => {
            const sql = `INSERT INTO manga_info (manga_id, cover, artist, author, bw, mu, mal, amz, ebj, engtl, raw, nu, kt, ap, al)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`;
            const vals = [
                mangaId,
                manga.getFullURL('cover'),
                manga.artists[0],
                manga.authors[0],
                manga.links.bw,
                manga.links.mu,
                manga.links.mal,
                manga.links.amz,
                manga.links.ebj,
                manga.links.engtl,
                manga.links.raw,
                manga.links.nu,
                manga.links.kt,
                manga.links.ap,
                manga.links.al
            ]

            pool.query(sql, vals)
                .then(res => {
                    const row = res.rows[0];
                    if (!row) return cb({});
                    cb(row);
                })
                .catch(err => {
                    console.error(err);
                    cb({});
                });

            // Might as well update chapter titles and add missing chapters while we're at it
            if (manga.chapters) {
                const chapters = manga.chapters.filter(c=>c.language==='GB').map(c => {
                    const chapter = c.chapter ? c.chapter.toString() : '0';
                    return [
                        mangaId, MANGADEX_ID,
                        c.title || `${c.volume !== undefined ? 'Volume ' + c.volume + ', ' : ''}${'Chapter ' + chapter}`,
                        chapter.split('.')[0], parseInt(chapter.split('.')[1]) || null,
                        new Date(c.timestamp*1000), c.id, c.firstGroupName
                    ];
                });

                if (chapters.length === 0) return;

                const chunkSize = 50;

                // This is a fucking stupid way to do bulk inserts but i don't wanna install
                // another lib just to do a single bulk insert
                for (let idx=0; idx < chapters.length; idx += chunkSize) {
                    const values = [];
                    const slice = chapters.slice(idx, idx+chunkSize)

                    for (let i=0; i<slice.length; i++) {
                        const x = i*8;
                        values.push(`($${x+1}, $${x+2}, $${x+3}, $${x+4}, $${x+5}, $${x+6}, $${x+7}, $${x+8})`)
                    }
                    const chapterSql = `INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group") 
                                        VALUES ${values.join(',')}
                                        ON CONFLICT (service_id, chapter_identifier) DO UPDATE SET title=EXCLUDED.title`;
                    pool.query(chapterSql, slice.flat())
                        .then(res => {
                            console.log(res.rowCount);
                        })
                        .catch(err => console.error(err));
                }

            }
        })
        .catch(() => cb({}));
}

function formatLinks(row) {
    Object.keys(row).forEach(key => {
        const link = Link[key];
        if (!link) return;

        row[key] = link.prefix + row[key];
    })
}

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