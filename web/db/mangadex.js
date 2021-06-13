const { Manga, Cover } = require('mangadex-full-api');

const { mangadexLimiter } = require('../utils/ratelimits');
const { db } = require('.');
const { dbLogger } = require('../utils/logging');

const MANGADEX_ID = 2; // Id of the mangadex service in the database
module.exports.MANGADEX_ID = MANGADEX_ID;

/**
 * Queues the manga for a scheduled run and fetches the mangadex cover for it unless ratelimited
 * @param {string} mangadexMangaId
 * @param {Number|string} mangaId
 * @return {Promise}
 */
function fetchExtraInfo(mangadexMangaId, mangaId) {
  const sql = 'INSERT INTO scheduled_runs (manga_id, service_id, created_by) VALUES ($1, $2, NULL) ON CONFLICT DO NOTHING';
  const p1 = db.none(sql, [mangaId, MANGADEX_ID])
    .catch(dbLogger.error);

  const p2 = mangadexLimiter.consume('mangadex', 1)
    .then(() => Manga.get(mangadexMangaId))
    .then(manga => Cover.get(manga.mainCover.id))
    .then(cover => db.none(
      'UPDATE manga_info SET cover=$1, last_updated=CURRENT_TIMESTAMP WHERE manga_id=$2',
      [cover.imageSource, mangaId]
    ))
    .catch(() => undefined);

  return Promise.all([p1, p2]);
}

module.exports.fetchExtraInfo = fetchExtraInfo;
