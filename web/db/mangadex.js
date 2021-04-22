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

async function fetchExtraInfo(mangadexId, mangaId, chapterIds, addChapters = true, limitChapters) {
  mangadexLimiter.consume('mangadex', 1)
    .then(() => {
      logger.debug(`Fetching extra info for ${mangaId} ${mangadexId}`);
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
                c.groups[0]?.title,
              ];
            });

            if (chapters.length === 0) return;

            logger.debug(`Adding ${chapters.length} mangadex chapters to manga ${mangaId} ${manga.title}`);

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
              db.result(chapterSql, slice.flat())
                .then(res => {
                  logger.debug('Added %d new chapters', res.rowCount);
                })
                .catch(err => logger.error(err));
            }
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
