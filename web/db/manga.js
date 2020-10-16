const { Manga, Util, link: Link, Chapter } = require('mangadex-full-api');
const debug = require('debug')('debug');

const db = require('.');
const { mangadexLimiter } = require('../utils/ratelimits');
const { HttpError } = require('../utils/errors');

const MANGADEX_ID = 2; // Id of the mangadex service in the database


// Fill that only does an api request
Manga.prototype.apiFill = function apiFill(id) {
  const jsonAPI = 'https://mangadex.org/api/manga/';

  // eslint-disable-next-line no-param-reassign
  if (!id) id = this.id;

  return new Promise((resolve, reject) => {
    if (!id) reject('No id specified or found.');
    Util.getJSON(jsonAPI + id.toString()).then((json) => {
      const origLinks = { ...json.manga.links };
      this._parse({ ...json, id });
      this.links = origLinks; // override default behavior of adding prefixes
      resolve(this);
    }).catch(reject);
  });
};
/**
 * Took me forever to debug this but since this gets compiled it sets the
 * oldParse function twice. First it's set to the base implementation and the
 * new function is as it's below. Then it will replace oldParse with this method
 * and replace the normal parse with the compiled one.
 * This is what you get for doing weird hacks to get your way around :(
 */
if (Chapter.prototype._oldParse === undefined) {
  Chapter.prototype._oldParse = Chapter.prototype._parse;
}
Chapter.prototype._parse = function newParse(data) {
  this._oldParse.toString();
  this._oldParse(data);
  this.firstGroupName = data.group_name;
};


function fetchExtraInfo(mangadexId, mangaId, cb, chapterIds, addChapters = true, limitChapters) {
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
                                                            al=excluded.al,
                                                            last_updated=CURRENT_TIMESTAMP
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
            manga.links.al,
          ];

          db.query(sql, vals)
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

            const chapters = (!limitChapters ?
              manga.chapters.filter(c => c.language === 'GB' && !alreadyExists.has(c.id.toString())) :
              manga.chapters.filter(c => c.language === 'GB')
              // Not sorted by default
                .sort((a, b) => (a.chapter < b.chapter ? 1 : -1))
                .slice(0, alreadyExists.size * 0.9)
                .filter(c => !alreadyExists.has(c.id.toString()))
            ).map(c => {
              const chapter = c.chapter ? c.chapter.toString() : '0';
              return [
                mangaId,
                MANGADEX_ID,
                c.title || `${c.volume !== undefined ? 'Volume ' + c.volume + ', ' : ''}${'Chapter ' + chapter}`,
                chapter.split('.')[0], parseInt(chapter.split('.')[1]) || null,
                new Date(c.timestamp * 1000),
                c.id,
                c.firstGroupName,
              ];
            });

            if (chapters.length === 0) return;

            debug(`Adding ${chapters.length} mangadex chapters to manga ${mangaId} ${manga.title}`);

            const chunkSize = 50;

            // This is a fucking stupid way to do bulk inserts but i don't wanna install
            // another lib just to do a single bulk insert
            for (let idx=0; idx < chapters.length; idx += chunkSize) {
              const values = [];
              const slice = chapters.slice(idx, idx+chunkSize);

              for (let i=0; i<slice.length; i++) {
                const x = i*8;
                values.push(`($${x+1}, $${x+2}, $${x+3}, $${x+4}, $${x+5}, $${x+6}, $${x+7}, $${x+8})`);
              }
              const chapterSql = `INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, "group") 
                                  VALUES ${values.join(',')}
                                  ON CONFLICT (service_id, chapter_identifier) DO UPDATE SET title=EXCLUDED.title`;
              db.query(chapterSql, slice.flat())
                .then(res => {
                  debug(res.rowCount);
                })
                .catch(err => console.error(err));
            }
          }
        })
        .catch((err) => {
          console.error(err);
          cb({});
        });
    })
    .catch(() => cb({}));
}

module.exports.fetchExtraInfo = fetchExtraInfo;

function formatLinks(row) {
  Object.keys(row).forEach(key => {
    const link = Link[key];
    if (!link) return;

    row[key] = link.prefix + row[key];
  });
}
module.exports.formatLinks = formatLinks;

function getManga(mangaId, chapters) {
  const chapterSql = `,(SELECT json_agg(ch) FROM 
                            (SELECT chapter_id, title, chapter_number, extract(EPOCH FROM release_date) * 1000 as release_date, "group", service_id, chapter_identifier as chapter_url FROM chapters WHERE manga_id=$1 ORDER BY chapter_number DESC, chapter_decimal DESC NULLS LAST LIMIT $2) ch) 
                         as chapters`;
  const args = [mangaId];
  let limit = parseInt(chapters);

  if (limit <= 50 && limit > 0) {
    args.push(limit);
  } else {
    limit = false;
  }

  const sql = `SELECT manga.manga_id, title, release_interval, latest_release, estimated_release, manga.latest_chapter,
                        array_agg(json_build_object('title_id', ms.title_id, 'service_id', ms.service_id, 'name', s.service_name, 'url_format', chapter_url_format, 'url', s.manga_url_format)) as services,
                        mi.cover, mi.status, mi.artist, mi.author, mi.last_updated,
                        mi.bw, mi.mu, mi.mal, mi.amz, mi.ebj, mi.engtl, mi.raw, mi.nu, mi.kt, mi.ap, mi.al 
                        ${limit ? chapterSql : ''}
               FROM manga LEFT JOIN manga_info mi ON manga.manga_id = mi.manga_id
                   INNER JOIN manga_service ms ON manga.manga_id = ms.manga_id
                   INNER JOIN services s ON ms.service_id = s.service_id
               WHERE manga.manga_id=$1
               GROUP BY manga.manga_id, mi.manga_id`;

  return db.query(sql, args)
    .then(rows => {
      if (!(rows.rowCount > 0)) {
        return null;
      }

      const row = rows.rows[0];

      const mdIdx = row.services.findIndex(v => v.service_id === MANGADEX_ID);
      // If info doesn't exist or 2 weeks since last update
      if ((!row.last_updated || (Date.now() - row.last_updated)/8.64E7 > 14) && mdIdx >= 0) {
        return new Promise(resolve => {
          fetchExtraInfo(row.services[mdIdx].title_id, mangaId,
            extra => {
              formatLinks(extra);
              resolve({ ...row, ...extra });
            },
            (limit && row.chapters) ? row.chapters.filter(c => c.service_id === MANGADEX_ID).map(c => c.chapter_url) : null,
            Boolean(limit),
            Boolean(row.last_updated));
        });
      }

      formatLinks(row);
      return row;
    });
}
module.exports.getManga = getManga;

function getFollows(userId) {
  if (!userId) {
    return new Promise((resolve, reject) => reject(HttpError(404)));
  }

  const sql = `SELECT m.title, mi.cover, m.manga_id, m.latest_release, m.latest_chapter,
                    (SELECT json_agg(s) FROM (
                       SELECT ms.service_id, service_name, ms.title_id, manga_url_format as url
                       FROM services INNER JOIN manga_service ms ON services.service_id = ms.service_id
                       WHERE ms.manga_id=m.manga_id) s) as services,
                    json_agg(uf.service_id) as followed_services
               FROM user_follows uf
                   INNER JOIN manga m ON uf.manga_id = m.manga_id
                   LEFT JOIN manga_info mi ON m.manga_id = mi.manga_id
               WHERE user_id=$1
               GROUP BY uf.manga_id, m.manga_id, mi.manga_id`;

  return db.query(sql, [userId])
    .then(res => new Promise((resolve) => resolve(res.rows)))
    .catch(err => {
      // integer overflow
      if (err.code === '22003' || err.code === '22P02') {
        return new Promise((resolve, reject) => reject(HttpError(404, 'Integer out of range')));
      }
      console.error(err);
      return new Promise((resolve, reject) => reject(HttpError(500)));
    });
}

module.exports.getFollows = getFollows;
