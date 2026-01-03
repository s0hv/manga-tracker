import type { QueryClient } from '@tanstack/react-query';
import { notFound } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';

import { getFullManga } from '@/db/manga';
import type { DatabaseId } from '@/types/dbTypes';

import { getMangaQueryOptions } from '../api/manga';

export const getFullMangaFn = createIsomorphicFn()
  .server(async (_, mangaId: DatabaseId) => {
    const manga = await getFullManga(mangaId);

    if (!manga) {
      throw notFound();
    }

    return manga;
  })
  .client(async (queryClient: QueryClient, mangaId: DatabaseId) => {
    return queryClient.ensureQueryData(getMangaQueryOptions(mangaId));
  });
