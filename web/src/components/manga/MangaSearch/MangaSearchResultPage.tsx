import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Box, CircularProgress, TextField, Typography } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';

import { searchMangaQueryOptions } from '#web/api/manga';
import type { SearchMangaParams } from '#web/schemas/manga';
import {
  type FiltersForm,
  MangaSearchFilters,
} from '@/components/manga/MangaSearch/MangaSearchFilters';

import { MangaSearchResults } from './MangaSearchResults';

export interface MangaSearchResultPageProps {
  searchQuery: string;
}

export const MangaSearchResultPage = ({
  searchQuery,
}: MangaSearchResultPageProps) => {
  const { ref, inView } = useInView();
  const [searchParams, setSearchParams] = useState<SearchMangaParams>({ query: searchQuery });
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);

  // If search query changed, force a rerender with the new query
  if (prevSearchQuery !== searchQuery) {
    setSearchParams({ query: searchQuery });
    setPrevSearchQuery(searchQuery);
  }

  const {
    data,
    hasNextPage,
    isFetching,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(searchMangaQueryOptions(searchParams));

  const mangas = useMemo(
    () => (data?.pages ?? []).map(r => r.data.searchResults).flat(),
    [data?.pages]
  );

  const onSubmit = useCallback((values: FiltersForm) => {
    setSearchParams({
      ...searchParams,

      serviceIds: values.serviceIds.length === 0
        ? undefined
        : values.serviceIds,

      status: values.status.length === 0
        ? undefined
        : values.status,
    });
  }, [searchParams]);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    const eventTarget = event.target;

    if (event.key === 'Enter' && eventTarget instanceof HTMLInputElement) {
      const value = eventTarget.value;

      if (value.trim().length < 2) return;

      setSearchParams(prev => ({ ...prev, query: value }));

      const url = new URL(window.location.href);
      url.searchParams.set('query', value);
      history.pushState(null, '', url);
    }
  }, []);

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && !isFetching) {
      void fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, isFetching]);

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 8,
        position: 'relative',
        width: '100%',
        p: 4,
        justifyContent: 'center',
        flexFlow: {
          xs: 'column',
          md: 'row',
        },
      }}
    >
      <MangaSearchFilters
        // Reset filters when search query changes
        key={searchQuery}
        serviceIds={data?.pages[0].data.serviceIds}
        onSubmit={onSubmit}
      />

      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxWidth: 'fit-content',
        // The "results" grid sizes its columns from this box's width, so the box
        // must take the space left over by the filters (flex: 1) and be allowed
        // to shrink below the grid's preferred width (minWidth: 0). Without
        // minWidth: 0, flex items default to min-width: auto and the grid
        // overflows instead of dropping columns on narrow screens.
        flex: 1,
        // Must stay 0. sx treats numbers in (0, 1] as percentages, so 1 would mean 100%.
        minWidth: 0,
      }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography
            variant='h1'
            sx={{
              fontSize: {
                xs: '2rem',
                sm: '3rem',
                md: '4rem',
              },
            }}
          >
            Search
          </Typography>

          <Typography variant='subtitle1' color='textSecondary' sx={{ mb: 2 }}>
            {data?.pages[0].count} results for "{searchParams.query}"
          </Typography>

          <TextField
            // Force rerender when search query changes
            key={searchQuery}
            variant='outlined'
            defaultValue={searchQuery}
            onKeyDown={onKeyDown}
            sx={{
              maxWidth: {
                xs: '100%',
                md: '500px',
              },
              mb: 4,
            }}
          />

          <MangaSearchResults
            mangaResults={mangas}
            loadMoreRef={ref}
          />
        </Box>

        {!isFetching && hasNextPage && <CircularProgress size={52} sx={{ alignSelf: 'center' }} />}

        {!isFetching && !hasNextPage && (
          <Typography color='textSecondary' align='center'>
            Reached the end
          </Typography>
        )}
      </Box>
    </Box>
  );
};
