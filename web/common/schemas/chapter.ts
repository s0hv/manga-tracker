import * as z from 'zod';

import { dbId } from './common';

export const DbChapter = z.strictObject({
  mangaId: dbId,
  chapterId: dbId,
  title: z.string().min(1),
  chapterNumber: z.int().positive(),
  chapterDecimal: z.int().positive().nullable(),
  releaseDate: z.date(),
  groupId: dbId,
  serviceId: dbId,
  chapterIdentifier: z.string().min(1),
});

export type DbChapter = z.infer<typeof DbChapter>;

export const DbChapterCreate = DbChapter
  .omit({ chapterId: true, groupId: true })
  .extend({
    // Group will be either created or an existing group will be used
    group: z.strictObject({
      groupId: dbId,
      name: z.string().nullable(),
    }).or(z.strictObject({
      groupId: z.null(),
      name: z.string(),
    })),
  });
export type DbChapterCreate = z.infer<typeof DbChapterCreate>;
