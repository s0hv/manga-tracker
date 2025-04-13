import camelcaseKeys from 'camelcase-keys';
import type { PendingQuery } from 'postgres';
import type {
  ChapterRelease,
  ChapterReleaseDates,
  MangaChapter,
} from '@/types/api/chapter';
import type { Chapter } from '@/types/db/chapter';
import type { DatabaseId, MangaId } from '@/types/dbTypes';
import type { DefaultExcept, PartialExcept } from '@/types/utility';
import { NO_GROUP } from '../utils/constants.js';
import { db } from './helpers';
import { generateUpdate } from './utils';
import type { SortBy } from '@/types/db/common';

export const getChapterReleases = (mangaId: MangaId) => {
  return db.manyOrNone<ChapterReleaseDates>`SELECT extract(EPOCH FROM date_trunc('day', release_date))::float8 as "timestamp", CAST(count(release_date) as int) count 
               FROM chapters 
               WHERE manga_id=${mangaId} GROUP BY 1 ORDER BY 1`;
};

export const getLatestChapters = (limit: number, offset: number, userId?: DatabaseId) => {
  return db.manyOrNone<ChapterRelease>`
      ${userId ? db.sql`WITH follow_all AS (
          SELECT manga_id FROM user_follows WHERE user_id=${userId} GROUP BY manga_id HAVING COUNT(*) != COUNT(service_id)
      ),
      follows AS (
          SELECT DISTINCT manga_id, service_id FROM user_follows WHERE user_id=${userId} AND manga_id NOT IN (SELECT manga_id FROM follow_all)
          UNION ALL
          SELECT manga_id, NULL as service_id FROM follow_all
      )` : db.sql``}
      SELECT
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
      ${userId ? db.sql`INNER JOIN follows f ON f.manga_id=m.manga_id AND (f.service_id IS NULL OR f.service_id=ms.service_id)` : db.sql``}
      ORDER BY release_date DESC
      LIMIT ${limit} ${offset ? db.sql`OFFSET ${offset}` : db.sql``}`;
};

export type AddChapter = DefaultExcept<Omit<Chapter, 'chapterId'>,
  | 'group'
  | 'chapterDecimal'
  | 'releaseDate'
>

export const addChapter = ({
  mangaId,
  serviceId,
  title,
  chapterNumber,
  chapterDecimal,
  releaseDate,
  chapterIdentifier,
  group = NO_GROUP,
}: AddChapter): Promise<number | undefined> => {
  releaseDate = releaseDate || new Date(Date.now());

  return db.oneOrNone<{chapterId: number}>`INSERT INTO chapters (manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, group_id) 
               VALUES (${mangaId}, ${serviceId}, ${title}, ${chapterNumber}, ${chapterDecimal}, ${releaseDate}, ${chapterIdentifier}, ${group})
               RETURNING chapter_id`
    .then(row => row?.chapterId);
};

export const defaultSort: SortBy[] = [
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

export const getChapters = (mangaId: MangaId, limit: number, offset: number, sortBy: SortBy[] = defaultSort) => {
  sortBy = sortBy.length > 0 ? sortBy : defaultSort;
  const sorting: PendingQuery<any> = sortBy
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

      console.log(row);
      return Promise.resolve({
        count: row.count,
        chapters: row.chapters ? camelcaseKeys(row.chapters) : [],
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


  return db.any`UPDATE chapters SET ${generateUpdate(chapter, db.sql)} WHERE chapter_id=${chapterId}`;
};

/**
 * Deletes a chapter
 */
export const deleteChapter = async (chapterId: DatabaseId) => {
  return db.oneOrNone<Chapter>`DELETE FROM chapters WHERE chapter_id=${chapterId} RETURNING *`;
};
