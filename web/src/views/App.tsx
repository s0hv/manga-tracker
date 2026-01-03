import React, { useMemo, useState } from 'react';
import { Container, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import {
  ChapterGroupWithCover,
  ChapterWithLink,
  GroupedChapterList,
} from '@/components/GroupedChapterList';
import type { ChapterRelease } from '@/types/api/chapter';
import { QueryKeys } from '@/webUtils/constants';

import { getLatestChapters } from '../api/chapter';
import { getServicesQueryOptions } from '../api/services';
import { useIsUserAuthenticated } from '../store/userStore';

const getGroupName = (_: unknown, chapters: ChapterRelease[]) => chapters[0].manga;

function App() {
  const isUserAuthenticated = useIsUserAuthenticated();
  const [mangaToCover, setMangaToCover] = useState<Record<string, string> | null>(null);
  const limit = 15;

  const {
    data: chapters,
    isFetching: isChaptersFetching,
  } = useQuery<ChapterRelease[]>({
    queryKey: [QueryKeys.LatestChapters, isUserAuthenticated],
    queryFn: () => getLatestChapters(limit, 0, isUserAuthenticated)
      .then(json => {
        setMangaToCover(
          json.reduce((prev, chapter) => ({ ...prev, [chapter.mangaId]: chapter.cover }), {})
        );
        return json;
      }),
    initialData: [],
  });

  const {
    data: services,
    isFetching: isServicesFetching,
  } = useQuery(getServicesQueryOptions);

  const GroupComponent = useMemo(() => ChapterGroupWithCover(mangaToCover || {}),
    [mangaToCover]);

  const ChapterComponent = useMemo(() => ChapterWithLink(services || {}), [services]);

  return (
    <Container maxWidth='lg' sx={{ minHeight: '50vh' }}>
      <Typography variant='h4' sx={{ m: 1 }}>Recent Releases {isUserAuthenticated ? '(for your follows)' : ''}</Typography>
      <GroupedChapterList
        chapters={chapters}
        groupKey='mangaId'
        groupToString={getGroupName}
        ChapterComponent={ChapterComponent}
        GroupComponent={GroupComponent}
        loading={isChaptersFetching || isServicesFetching}
        skeletons={limit}
      />
    </Container>

  );
}

export default App;
