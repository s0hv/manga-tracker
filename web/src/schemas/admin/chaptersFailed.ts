import * as z from 'zod';

import { isoDatetimeToDate } from '#common/schemas/common';


export const ChapterFail = z.object({
  chapterIdentifier: z.string(),
  serviceId: z.int(),
  mangaId: z.int().nullable(),
  errors: z.string(),
  title: z.string().nullable(),
  chapterNumber: z.int().nullable(),
  chapterDecimal: z.int().nullable(),
  titleId: z.string().nullable(),
  mangaTitle: z.string().nullable(),
  releaseDate: isoDatetimeToDate.nullable(),
  group: z.string().nullable(),
  timestamp: isoDatetimeToDate,
});

export type ChapterFail = z.infer<typeof ChapterFail>;

export const ChaptersFailedResponse = z.object({
  data: z.array(ChapterFail),
});
