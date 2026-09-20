import camelcaseKeys from 'camelcase-keys';
import * as z from 'zod';

import type { MangaChapter } from '@/types/api/chapter';
import type { Chapter } from '@/types/db/chapter';
import type { SortBy } from '@/types/db/common';
import type { DatabaseId, MangaId } from '@/types/dbTypes';
import type { DefaultExcept, PartialExcept } from '@/types/utility';


import { db, sql, voidSql } from './index';
import { NO_GROUP } from '../utils/constants';

import {
  ChapterPageRawRow,
  ChapterReleaseDatesRow,
  ChapterReleaseRow,
  ChapterRow,
} from './schemas/chapter';
import { updateSet } from './utils';

export const getChapterReleases = (mangaId: MangaId) => {
  return db.any(sql.type(ChapterReleaseDatesRow)`
      SELECT
          extract(EPOCH FROM date_trunc('day', release_date))::float8 as "timestamp",
          CAST(count(release_date) as int) count
      FROM chapters
      WHERE manga_id = ${mangaId}
      GROUP BY 1
      ORDER BY 1`);
};

export const getLatestChapters = (limit: number, offset?: number, userId?: DatabaseId) => {
  const withClause = userId
    ? sql.fragment`WITH follow_all AS (
            SELECT manga_id FROM user_follows WHERE user_id=${userId} GROUP BY manga_id HAVING COUNT(*) != COUNT(service_id)
          ),
          follows AS (
            SELECT DISTINCT manga_id, service_id
            FROM user_follows
            WHERE user_id=${userId} AND manga_id NOT IN (SELECT manga_id FROM follow_all)
            UNION ALL
            SELECT manga_id, NULL as service_id FROM follow_all
          )`
    : sql.fragment``;

  const followsJoin = userId
    ? sql.fragment`INNER JOIN follows f ON f.manga_id=m.manga_id AND (f.service_id IS NULL OR f.service_id=ms.service_id)`
    : sql.fragment``;

  return db.any(sql.type(ChapterReleaseRow)`
      ${withClause}
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
      ${followsJoin}
      ORDER BY release_date DESC
      LIMIT ${limit} ${offset ? sql.fragment`OFFSET ${offset}` : sql.fragment``}`);
};

export type AddChapter = DefaultExcept<Omit<Chapter, 'chapterId'>,
  | 'group'
  | 'chapterDecimal'
  | 'releaseDate'
>;

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
  releaseDate = releaseDate ?? new Date(Date.now());

  return db.maybeOne(sql.type(z.object({ chapterId: z.int() }))`
      INSERT INTO chapters
          (manga_id,
           service_id,
           title,
           chapter_number,
           chapter_decimal,
           release_date,
           chapter_identifier,
           group_id)
      VALUES
          (${mangaId},
           ${serviceId},
           ${title},
           ${chapterNumber},
           ${chapterDecimal ?? null},
           ${sql.timestamp(releaseDate)},
           ${chapterIdentifier},
           ${group})
      RETURNING chapter_id`)
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

export const getChapters = (
  mangaId: MangaId,
  limit: number,
  offset: number,
  sortBy: SortBy[] = defaultSort,
  services?: number[]
) => {
  sortBy = sortBy.length > 0 ? sortBy : defaultSort;
  const sorting = sql.join(
    sortBy.map(sort => {
      const sortDirection = sort.desc ? sql.fragment` DESC` : sql.fragment``;
      const nullsLast = sort.nullsLast ? sql.fragment` NULLS LAST` : sql.fragment``;
      return sql.fragment`${sql.identifier([sort.col])}${sortDirection}${nullsLast}`;
    }),
    sql.fragment`, `
  );

  return db.maybeOne(sql.type(ChapterPageRawRow)`
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
                WHERE 
                  manga_id=${mangaId} 
                  ${services && services.length > 0
                    ? sql.fragment`AND chapters.service_id = ANY(${sql.array(services, 'int4')})`
                    : sql.fragment``}
                ORDER BY ${sorting}
                LIMIT ${limit} ${offset ? sql.fragment`OFFSET ${offset}` : sql.fragment``}
            ) as ch
        ) as chapters,
       (exists(SELECT 1 FROM manga WHERE manga_id=${mangaId})) as "exists"
    FROM chapters
    INNER JOIN manga m ON m.manga_id = chapters.manga_id
    WHERE m.manga_id=${mangaId}
  `)
    .then(row => {
      if (!row?.exists) return Promise.resolve(null);

      return Promise.resolve({
        count: row.count,
        chapters: row.chapters ? camelcaseKeys(row.chapters) as unknown as MangaChapter[] : [],
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
}: PartialExcept<Chapter, 'chapterId'>) => {
  const chapter = {
    title,
    chapterNumber,
    chapterDecimal,
    releaseDate,
    chapterIdentifier,
  };

  return db.query(voidSql`UPDATE chapters SET ${updateSet(chapter)} WHERE chapter_id=${chapterId}`);
};

/**
 * Deletes a chapter
 */
export const deleteChapter = async (chapterId: DatabaseId) => {
  return db.maybeOne(sql.type(ChapterRow)`DELETE FROM chapters WHERE chapter_id=${chapterId} RETURNING *`);
};
