import camelcaseKeys from 'camelcase-keys';
import { NO_GROUP } from '../utils/constants.js';
import { generateUpdate } from './utils';
import { db } from './helpers';
import type { DatabaseId, MangaId } from '@/types/dbTypes';
import type { Chapter } from '@/types/db/chapter';
import type { MangaChapter } from '@/types/api/chapter';
import type { PartialExcept } from '@/types/utility';

export const getChapterReleases = (mangaId: MangaId) => {
  return db.manyOrNone`SELECT extract(EPOCH FROM date_trunc('day', release_date)) as "timestamp", CAST(count(release_date) as int) count 
               FROM chapters 
               WHERE manga_id=${mangaId} GROUP BY 1 ORDER BY 1`;
};

export const getLatestChapters = (limit: number, offset: number) => {
  return db.manyOrNone`SELECT
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
                LIMIT ${limit} ${offset ? db.sql`OFFSET ${offset}` : db.sql``}`;
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
}: Chapter): Promise<number | undefined> => {
  releaseDate = releaseDate || new Date(Date.now());

  return db.oneOrNone<{chapterId: number}>`INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, group_id) 
               VALUES (${mangaId}, ${serviceId}, ${title}, ${chapterNumber}, ${chapterDecimal}, ${releaseDate}, ${chapterIdentifier}, ${group})
               RETURNING chapter_id`
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

export const getChapters = (mangaId: MangaId, limit: number, offset: number, sortBy = defaultSort) => {
  sortBy = sortBy.length > 0 ? sortBy : defaultSort;
  const sorting: ReturnType<typeof db.sql> = sortBy
    .map((sort) => db.sql`${db.sql(sort.col)}${sort.desc ? db.sql` DESC` : db.sql``}${sort.nullsLast ? db.sql` NULLS LAST` : db.sql``}`)
    .reduce((acc, sort) => db.sql`${acc}, ${sort}`);

  return db.oneOrNone<{count: number, chapters: MangaChapter[], exists: boolean}>`
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
                WHERE manga_id=${mangaId}
                ORDER BY ${sorting}
                LIMIT ${limit} ${offset ? db.sql`OFFSET ${offset}` : db.sql``}
            ) as ch
        ) as chapters,
       (exists(SELECT 1 FROM manga WHERE manga_id=${mangaId})) as "exists"
    FROM chapters
    INNER JOIN manga m ON m.manga_id = chapters.manga_id
    WHERE m.manga_id=${mangaId}
  `
    .then(row => {
      if (!row || !row.exists) return Promise.resolve(null);

      return Promise.resolve({
        count: row.count,
        chapters: camelcaseKeys(row.chapters),
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
}: PartialExcept<Chapter, 'chapterId'>) => {
  const chapter = {
    title,
    chapterNumber,
    chapterDecimal,
    releaseDate,
    chapterIdentifier,
    // group,
  };


  return db.sql`UPDATE chapters SET ${generateUpdate(chapter, db.sql)} WHERE chapter_id=${chapterId}`;
};

/**
 * Deletes a chapter
 */
export const deleteChapter = async (chapterId: DatabaseId) => {
  return db.oneOrNone<Chapter>`DELETE FROM chapters WHERE chapter_id=${chapterId} RETURNING *`;
};
