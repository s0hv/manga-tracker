import * as z from 'zod';

export const ChapterReleaseDatesRow = z.strictObject({
  timestamp: z.number(),
  count: z.int(),
});

export type ChapterReleaseDatesRow = z.infer<typeof ChapterReleaseDatesRow>;

export const ChapterReleaseRow = z.strictObject({
  chapterId: z.int(),
  title: z.string(),
  chapterNumber: z.int(),
  chapterDecimal: z.int().nullable(),
  releaseDate: z.date(),
  group: z.string(),
  serviceId: z.int(),
  chapterIdentifier: z.string(),
  manga: z.string(),
  mangaId: z.int(),
  titleId: z.string(),
  cover: z.string().nullable(),
});

export type ChapterReleaseRow = z.infer<typeof ChapterReleaseRow>;

/**
 * Raw shape of `getChapters`'s result, before the nested `json_agg` chapters (whose keys are
 * unaffected by the shallow top-level camelCase transform) are camelCased.
 */
export const ChapterPageRawRow = z.strictObject({
  count: z.int(),
  chapters: z.array(z.strictObject({
    chapter_id: z.int(),
    title: z.string(),
    chapter_number: z.int(),
    chapter_decimal: z.int().nullable(),
    release_date: z.iso.datetime({ offset: true }),
    group: z.string(),
    service_id: z.int(),
    chapter_identifier: z.string(),
  })).nullable(),
  exists: z.boolean(),
});

export type ChapterPageRawRow = z.infer<typeof ChapterPageRawRow>;

// The real `chapters` table row shape. Note the FK column is `group_id` (an int), not `group`
// (the group name) — unlike the `LatestRelease`/`ChapterRelease` query results above which alias
// the joined group's name to "group".
export const ChapterRow = z.strictObject({
  mangaId: z.int(),
  chapterId: z.int(),
  serviceId: z.int(),
  title: z.string(),
  chapterNumber: z.int(),
  chapterDecimal: z.int().nullable(),
  releaseDate: z.date(),
  chapterIdentifier: z.string(),
  groupId: z.int(),
  group: z.string().nullable(),
  isNotificationSent: z.boolean(),
});

export type ChapterRow = z.infer<typeof ChapterRow>;
