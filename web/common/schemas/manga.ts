import * as z from 'zod';

import { isoDatetimeToDate, MangaStatusSchema } from './common';

export const SearchedManga = z.object({
  mangaId: z.number(),
  title: z.string(),
  coverUrl: z.string().nullable(),
  latestChapter: z.number().nullable(),
  latestRelease: isoDatetimeToDate.or(z.date()).nullable(),
  status: MangaStatusSchema.nullable(),
  serviceIds: z.array(z.number()),
});
export type SearchedMangaSchema = z.infer<typeof SearchedManga>;
