import React from 'react';
import { createFileRoute } from '@tanstack/react-router';

import { SearchMangaParams } from '#web/schemas/manga';
import {
  MangaSearchResultPage,
} from '@/components/manga/MangaSearch/MangaSearchResultPage';
import { defineMeta } from '@/webUtils/meta';


export const Route = createFileRoute('/manga/search')({
  head: () => {
    return {
      meta: defineMeta({
        title: 'Search for manga',
      }),
    };
  },
  component: MangaSearchPage,
  validateSearch: SearchMangaParams.pick({ query: true }),
});


function MangaSearchPage() {
  const search = Route.useSearch();

  return <MangaSearchResultPage searchQuery={search.query} />;
}

