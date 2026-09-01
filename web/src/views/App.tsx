import React, { useCallback, useMemo, useState } from 'react';
import DensityLarge from '@mui/icons-material/DensityLarge';
import DensitySmall from '@mui/icons-material/DensitySmall';
import {
  Box,
  Container,
  Tab,
  Tabs,
  ToggleButton,
  Typography,
} from '@mui/material';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { last } from 'es-toolkit';

import type { PageParams } from '#web/api/types';
import {
  ChapterGroupWithCover,
  ChapterWithLink,
  GroupedChapterList,
  useGroupedChapters,
} from '@/components/chapter/GroupedChapterList';
import type { ChapterRelease } from '@/types/api/chapter';
import { MAX_OFFSET } from '@/webUtils/constants';

import { getLatestChaptersQueryOptions } from '../api/chapter';
import { getServicesQueryOptions } from '../api/services';
import { useIsUserAuthenticated } from '../store/userStore';

const getGroupName = (_: unknown, chapters: ChapterRelease[]) => chapters[0].manga;
const pageSize = 15;

function App() {
  const isUserAuthenticated = useIsUserAuthenticated();
  const [showFollows, setShowFollows] = useState(isUserAuthenticated);
  const [isComfortable, setIsComfortable] = useState(true);

  const toggleIsComfortable = useCallback(() => setIsComfortable(prev => !prev), []);
  const changeTab = useCallback((_: unknown, newValue: string) => setShowFollows(newValue === 'true'), []);

  const useFollows = isUserAuthenticated && showFollows;

  const {
    data: { pages, pageParams },
    isFetching: isChaptersFetching,
    isFetchedAfterMount,
    fetchNextPage,
  } = useInfiniteQuery(getLatestChaptersQueryOptions(pageSize, useFollows));

  const isLastPage = useMemo(
    () => {
      const lastPage = last(pageParams as PageParams[]);
      if (!lastPage) return false;

      return lastPage.offset >= MAX_OFFSET
        || (last(pages || []) ?? []).length < pageSize;
    },
    [pageParams, pages]
  );

  const {
    data: services,
    isFetching: isServicesFetching,
  } = useQuery(getServicesQueryOptions);

  const chapters = useMemo(() => pages.flat(), [pages]);
  const groupedChapters = useGroupedChapters(chapters);

  const mangaToCover = useMemo(
    () => chapters.reduce<Record<string, string>>((prev, chapter) => (
      {
        ...prev,
        [chapter.mangaId]: chapter.cover,
      }
    ), {}),
    [chapters]
  );

  return (
    <Container maxWidth='lg' sx={{ minHeight: '50vh' }}>
      <Typography variant='h4' sx={{ mx: 1, mb: 0, mt: 2 }}>
        Recent Releases
      </Typography>

      <Typography
        variant='caption'
        color='textSecondary'
        sx={{ m: 1, mb: 2 }}
      >
        {isChaptersFetching ? '-' : chapters.length} chapters
        {' · '}
        {isChaptersFetching ? '-' : groupedChapters.length} series
      </Typography>

      <Box
        sx={{
          display: 'flex',
          borderBottom: 1,
          borderColor: 'divider',
          mb: 2,
          pb: isUserAuthenticated ? undefined : 1,
        }}
      >
        {isUserAuthenticated && (
          <Tabs
            onChange={changeTab}
            value={String(showFollows)}
            sx={{
              minWidth: 'fit-content',
            }}
          >
            <Tab label='All releases' value='false' />
            <Tab label='My follows' value='true' />
          </Tabs>
        )}

        <Box sx={{ width: '100%' }} />

        <Typography
          variant='caption'
          color='textSecondary'
          sx={{
            alignContent: 'center',
            display: {
              xs: 'none',
              sm: undefined,
            },
          }}
        >
          {isComfortable ? 'Comfortable' : 'Compact'}
        </Typography>

        <ToggleButton
          value='isComfortable'
          onChange={toggleIsComfortable}
          size='small'
          sx={{
            maxHeight: 'fit-content',
            maxWidth: 'fit-content',
            alignSelf: 'center',
            ml: 2,
            width: '34px',
            height: '34px',
          }}
        >
          {isComfortable ? <DensityLarge /> : <DensitySmall />}
        </ToggleButton>
      </Box>

      <GroupedChapterList
        groupedChapters={groupedChapters}
        groupToString={getGroupName}
        onLoadMore={fetchNextPage}
        ChapterComponent={ChapterWithLink}
        chapterComponentProps={{ services: services ?? {}}}
        GroupComponent={ChapterGroupWithCover}
        groupComponentProps={{ mangaToCover }}
        // Use isFetchedAfterMount to prevent loading indicators when loading
        // next pages
        loading={(!isFetchedAfterMount && isChaptersFetching) || isServicesFetching}
        isLastPage={isLastPage}
        pageSize={pageSize}
        chapterRowGap={isComfortable ? undefined : '0px'}
      />
    </Container>

  );
}

export default App;
