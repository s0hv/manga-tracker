import { Manga, Cover } from 'mangadex-full-api';

import { mangadexLimiter } from '../utils/ratelimits.js';
import { db } from './index.js';
import { dbLogger } from '../utils/logging.js';

export const MANGADEX_ID = 2; // Id of the mangadex service in the database

/**
 * Queues the manga for a scheduled run and fetches the mangadex cover for it unless ratelimited
 * @param {string} mangadexMangaId
 * @param {Number|string} mangaId
 * @return {Promise}
 */
export function fetchExtraInfo(mangadexMangaId, mangaId) {
  const sql = 'INSERT INTO scheduled_runs (manga_id, service_id, created_by) VALUES ($1, $2, NULL) ON CONFLICT DO NOTHING';
  const p1 = db.none(sql, [mangaId, MANGADEX_ID])
    .catch(dbLogger.error);

  const p2 = mangadexLimiter.consume('mangadex', 1)
    .then(() => Manga.get(mangadexMangaId))
    .then(manga => Cover.get(manga.mainCover.id))
    .then(cover => db.none(
      // Might sometimes result in the update not being done due to missing manga_info row.
      // This should be rare and the scheduled run should fix the cover when it is run.
      'UPDATE manga_info SET cover=$1, last_updated=CURRENT_TIMESTAMP WHERE manga_id=$2',
      [cover.imageSource, mangaId]
    ))
    .catch(() => undefined);

  return Promise.all([p1, p2]);
}
