import * as z from 'zod';

import { MangaStatusSchema } from '@/common/schemas/common';
import { SearchedManga } from '@/common/schemas/manga';

export const MangaSearchResponse = z.object({
  data: z.object({
    searchResults: z.array(SearchedManga),
    serviceIds: z.array(z.number()),
  }),
  count: z.number(),
});
export type MangaSearchResponse = z.infer<typeof MangaSearchResponse>;

export const SearchMangaParams = z.object({
  query: z.string(),
  serviceIds: z.array(z.number()).optional(),
  status: z.array(MangaStatusSchema).optional(),
});
export type SearchMangaParams = z.infer<typeof SearchMangaParams>;
