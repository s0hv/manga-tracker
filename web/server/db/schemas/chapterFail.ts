import * as z from 'zod';

export const ChapterFailRow = z.strictObject({
  chapterIdentifier: z.string(),
  serviceId: z.int(),
  mangaId: z.int().nullable(),
  errors: z.string(),
  title: z.string().nullable(),
  chapterNumber: z.int().nullable(),
  chapterDecimal: z.int().nullable(),
  titleId: z.string().nullable(),
  mangaTitle: z.string().nullable(),
  releaseDate: z.date().nullable(),
  group: z.string().nullable(),
  timestamp: z.date(),
});

export type ChapterFailRow = z.infer<typeof ChapterFailRow>;
