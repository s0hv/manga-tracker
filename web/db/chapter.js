import { NO_GROUP } from '../utils/constants.js';
import { generateUpdate } from './utils.js';
import { db, pgp } from './index.js';

export const getChapterReleases = (mangaId) => {
  const sql = `SELECT extract(EPOCH FROM date_trunc('day', release_date)) as "timestamp", CAST(count(release_date) as int) count 
               FROM chapters 
               WHERE manga_id=$1 GROUP BY 1 ORDER BY 1`;

  return db.query(sql, [mangaId]);
};

export const getLatestChapters = (limit, offset) => {
  const sql = `SELECT
                    chapter_id,
                    chapters.title,
                    chapter_number,
                    chapter_decimal,
                    release_date,
                    g.name as "group",
                    chapters.service_id,
                    chapter_identifier,
                    m.title as manga,
                    m.manga_id,
                    ms.title_id,
                    mi.cover
                FROM chapters
                INNER JOIN groups g ON g.group_id = chapters.group_id
                INNER JOIN manga m ON chapters.manga_id = m.manga_id
                INNER JOIN manga_service ms ON chapters.manga_id = ms.manga_id AND chapters.service_id=ms.service_id
                LEFT JOIN manga_info mi ON m.manga_id = mi.manga_id
                ORDER BY release_date DESC
                LIMIT $1 ${offset ? 'OFFSET $2' : ''}`;

  const args = [limit];
  if (offset) {
    args.push(offset);
  }

  return db.query(sql, args);
};

export const addChapter = ({
  mangaId,
  serviceId,
  title,
  chapterNumber,
  chapterDecimal,
  releaseDate,
  chapterIdentifier,
  group = NO_GROUP,
}) => {
  const sql = `INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, group_id) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING chapter_id`;
  releaseDate = releaseDate || new Date(Date.now());
  return db.oneOrNone(sql, [mangaId, serviceId, title, chapterNumber, chapterDecimal, releaseDate, chapterIdentifier, group])
    .then(row => row?.chapterId);
};

export const defaultSort = [
  {
    col: 'chapter_number',
    desc: true,
  },
  {
    col: 'chapter_decimal',
    desc: true,
    nullsLast: true,
  },
];

export const getChapters = (mangaId, limit, offset, sortBy = defaultSort) => {
  sortBy = sortBy.length > 0 ? sortBy : defaultSort;
  const sorting = sortBy.map(sort => `${pgp.as.name(sort.col)}${sort.desc ? ' DESC' : ''}${sort.nullsLast ? ' NULLS LAST' : ''}`).join(',');
  const sql = `
    SELECT
        COUNT(*)::INT as count,
        (
            SELECT json_agg(ch)
            FROM (
                SELECT
                    chapter_id,
                    title,
                    chapter_number,
                    chapter_decimal,
                    release_date,
                    g.name as "group",
                    service_id,
                    chapter_identifier
                FROM chapters
                INNER JOIN groups g ON g.group_id = chapters.group_id
                WHERE manga_id=$1
                ORDER BY ${sorting}
                LIMIT $2 ${offset ? 'OFFSET $3' : ''}
            ) as ch
        ) as chapters,
       (exists(SELECT 1 FROM manga WHERE manga_id=$1)) as "exists"
    FROM chapters
    INNER JOIN manga m ON m.manga_id = chapters.manga_id
    WHERE m.manga_id=$1
  `;

  const args = [mangaId, limit];
  if (offset) args.push(offset);

  return db.oneOrNone(sql, args)
    .then(row => {
      if (!row || !row.exists) return Promise.resolve(null);

      return Promise.resolve({
        count: row.count,
        chapters: row.chapters,
      });
    });
};

/**
 * Updates an existing chapter row
 * @param {Object} chapter
 */
export const editChapter = async ({
  chapterId,
  title,
  chapterNumber,
  chapterDecimal,
  releaseDate,
  chapterIdentifier,
  // group,
}) => {
  const chapter = {
    title,
    chapter_number: chapterNumber,
    chapter_decimal: chapterDecimal,
    release_date: releaseDate,
    chapter_identifier: chapterIdentifier,
    // group,
  };


  const sql = `${generateUpdate(chapter, 'chapters')} WHERE chapter_id=$1`;
  return db.result(sql, [chapterId]);
};

/**
 * Deletes a chapter
 * @param {Number} chapterId
 */
export const deleteChapter = async (chapterId) => {
  const sql = 'DELETE FROM chapters WHERE chapter_id=$1 RETURNING *';
  return db.oneOrNone(sql, [chapterId]);
};
