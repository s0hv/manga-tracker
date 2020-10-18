const { Manga, Util, Chapter } = require('mangadex-full-api');
const debug = require('debug')('debug');

const db = require('.');
const { mangadexLimiter } = require('../utils/ratelimits');

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


async function fetchExtraInfo(mangadexId, mangaId, chapterIds, addChapters = true, limitChapters) {
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
          return {};
        });
    })
    .catch(() => {});
}

module.exports.fetchExtraInfo = fetchExtraInfo;
