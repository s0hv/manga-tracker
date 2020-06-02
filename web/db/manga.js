const { Manga, Util, link: Link, Chapter } = require("mangadex-full-api");
const pool = require('./../db');
const { mangadexLimiter } = require('./../utils/ratelimits');
const { HttpError } = require('./../utils/errors');

const MANGADEX_ID = 2; // Id of the mangadex service in the database

const debug = require('debug')('debug');

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

function fetchExtraInfo(mangadexId, mangaId, cb, chapterIds, addChapters=true) {
    mangadexLimiter.consume('mangadex', 1)
        .then(() => {

        const manga = new Manga();
        debug(`Fetching extra info for ${mangaId} ${mangadexId}`);
        manga.apiFill(mangadexId)
            .then(() => {
                const sql = `INSERT INTO manga_info as mi (manga_id, cover, artist, author, bw, mu, mal, amz, ebj, engtl, raw, nu, kt, ap, al)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
                             ON CONFLICT (manga_id) DO UPDATE SET cover=excluded.cover, 
                                                                  artist=COALESCE(excluded.artist, mi.artist), 
                                                                  author=COALESCE(excluded.author, mi.author),
                                                                  bw=excluded.bw,
                                                                  mu=excluded.mu,
                                                                  mal=excluded.mal,
                                                                  amz=excluded.amz,
                                                                  ebj=excluded.ebj,
                                                                  engtl=excluded.engtl,
                                                                  raw=excluded.raw,
                                                                  nu=excluded.nu,
                                                                  kt=excluded.kt,
                                                                  ap=excluded.ap,
                                                                  al=excluded.al
                             RETURNING *`;
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
                if (addChapters && manga.chapters) {
                    const alreadyExists = new Set(chapterIds);
                    const chapters = manga.chapters.filter(c=>c.language==='GB' && !alreadyExists.has(c.id.toString())).map(c => {
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
                                debug(res.rowCount);
                            })
                            .catch(err => console.error(err));
                    }

                }
            })
            .catch(() => cb({}));
    })
        .catch(() => cb({}))
}

module.exports.fetchExtraInfo = fetchExtraInfo;

function formatLinks(row) {
    Object.keys(row).forEach(key => {
        const link = Link[key];
        if (!link) return;

        row[key] = link.prefix + row[key];
    })
}
module.exports.formatLinks = formatLinks;

function getManga(mangaId, chapters, cb) {
    const chapterSql = `(SELECT json_agg(ch) FROM 
                            (SELECT title, chapter_number, release_date, "group", service_id, chapter_identifier as chapter_url FROM chapters WHERE manga_id=$1 ORDER BY chapter_number DESC, chapter_decimal DESC NULLS LAST LIMIT $2) ch) 
                         as chapters,`
    const args = [mangaId];
    let limit = parseInt(chapters);

    if (limit <= 50 && limit > 0) {
        args.push(limit);
    } else {
        limit = false;
    }
    const sql = `SELECT manga.manga_id, title, release_interval, latest_release, estimated_release, manga.latest_chapter,
                        array_agg(json_build_object('title_id', ms.title_id, 'service_id', ms.service_id, 'name', s.service_name, 'url_format', chapter_url_format, 'url', s.manga_url_format)) as services,
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
                cb(HttpError(404), null);
                return;
            }

            const row = rows.rows[0];

            const mdIdx = row.services.findIndex(v => v.service_id === MANGADEX_ID);
            if ((!row.info_exists || !row.cover) && mdIdx >= 0) {
                fetchExtraInfo(row.services[mdIdx].title_id, mangaId,
                    extra => {
                        formatLinks(extra);
                        cb(null, {...row, ...extra});
                    },
                    (limit && row.chapters) ? row.chapters.map(c => c.chapter_url) : null,
                    Boolean(limit));
                return;
            }

            formatLinks(row);
            cb(null, row);
        })
        .catch(err => {
            // integer overflow
            if (err.code === '22003' || err.code === '22P02') {
                cb(HttpError(404, "Integer out of range"), null);
                return;
            }
            console.error(err);
            cb(HttpError(500), null)
        })
}

module.exports.getManga = getManga;