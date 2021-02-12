const { link: Link } = require('mangadex-full-api');

const db = require('.');
const { fetchExtraInfo } = require('./mangadex');
const { HttpError } = require('../utils/errors');

const MANGADEX_ID = 2; // Id of the mangadex service in the database

function formatLinks(row) {
  if (typeof row !== 'object') return;

  Object.keys(row).forEach(key => {
    const link = Link[key];
    if (!link || !row[key]) return;

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
                        mi.bw, mi.mu, mi.mal, mi.amz, mi.ebj, mi.engtl, mi.raw, mi.nu, mi.kt, mi.ap, mi.al,
                        (SELECT array_agg(title) FROM manga_alias ma WHERE ma.manga_id=$1) as aliases
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
        return fetchExtraInfo(row.services[mdIdx].title_id, mangaId,
          (limit && row.chapters) ? row.chapters.filter(c => c.service_id === MANGADEX_ID).map(c => c.chapter_url) : null,
          Boolean(limit),
          Boolean(row.last_updated))
          .then(extra => {
            formatLinks(extra);
            return { ...row, ...extra };
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

const getAliases = (mangaId) => {
  const sql = 'SELECT title FROM manga_alias WHERE manga_id=$1';
  return db.query(sql, [mangaId])
    .then(res => res.rows);
};
module.exports.getAliases = getAliases;

// Actually just gets a single row from the manga table
const getMangaPartial = (mangaId) => {
  const sql = 'SELECT * FROM manga WHERE manga_id=$1';
  return db.query(sql, [mangaId])
    .then(res => res.rows[0]);
};
module.exports.getMangaPartial = getMangaPartial;
