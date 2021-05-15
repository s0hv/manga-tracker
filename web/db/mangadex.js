const { Manga, link: Links } = require('mangadex-full-api');

const { db } = require('.');
const { mangadexLimiter } = require('../utils/ratelimits');
const logger = require('../utils/logging').mangadexLogger;

const MANGADEX_ID = 2; // Id of the mangadex service in the database
const linkObjects = {
  al: Links.al,
  ap: Links.ap,
  bw: Links.bw,
  kt: Links.kt,
  mu: Links.mu,
  amz: Links.amz,
  ebj: Links.ebj,
  mal: Links.mal,
  raw: Links.raw,
  engtl: Links.engtl,
  nu: Links.nu,
};

function getLinks(fullLinks) {
  const retVal = {};
  Object.keys(fullLinks).forEach(site => {
    const link = fullLinks[site];
    const lo = linkObjects[site];
    if (!lo) return;

    retVal[site] = link.replace(lo.prefix, '');
  });

  return retVal;
}

async function fetchExtraInfo(mangadexId, mangaId, chapterIds, forcedCheck = true) {
  return {};
  // Temporarily disabled
  /* eslint-disable no-unreachable */
  mangadexLimiter.consume('mangadex', 1)
    .then(() => {
      logger.info(`Fetching extra info for ${mangaId} ${mangadexId}`);
      new Manga(mangadexId).fill(mangadexId)
        .then((manga) => {
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

          const links = getLinks(manga.links);
          const vals = [
            mangaId,
            manga.cover,
            manga.artists[0],
            manga.authors[0],
            links.bw,
            links.mu,
            links.mal,
            links.amz,
            links.ebj,
            links.engtl,
            links.raw,
            links.nu,
            links.kt,
            links.ap,
            links.al,
          ];

          db.oneOrNone(sql, vals)
            .then(row => {
              if (!row) return {};
              return row;
            })
            .catch(err => {
              console.error(err);
              return {};
            });

          // Might as well update chapter titles and add missing chapters while we're at it
          if (forcedCheck) {
            const runSql = 'INSERT INTO scheduled_runs (manga_id, service_id, created_by) VALUES ($1, $2, $3)';
            db.none(runSql, [mangaId, MANGADEX_ID, null]);
          }
        })
        .catch((err) => {
          logger.error(err);
          return {};
        });
    })
    .catch(() => {});
}

module.exports.fetchExtraInfo = fetchExtraInfo;
