import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Container, Typography } from '@mui/material';
import { getLatestChapters } from '../api/chapter';
import { getServices } from '../api/services';
import {
  ChapterGroupWithCover,
  ChapterWithLink,
} from '@/components/GroupedChapterList';
import type { ChapterRelease } from '@/types/api/chapter';
import type { ServiceForApi } from '@/types/api/services';
import { useUser } from '@/webUtils/useUser';

const GroupedChapterList = dynamic(import('../components/GroupedChapterList'));

const getGroupName = (_: unknown, chapters: ChapterRelease[]) => chapters[0].manga;

function App() {
  const { user } = useUser();
  const [chapters, setChapters] = useState<ChapterRelease[]>([]);
  const [services, setServices] = useState<Record<number, ServiceForApi> | null>(null);
  const [mangaToCover, setMangaToCover] = useState<Record<string, string> | null>(null);
  const limit = 15;

  useEffect(() => {
    getLatestChapters(limit, 0, Boolean(user))
      .then(json => {
        setMangaToCover(
          json.reduce((prev, chapter) => ({ ...prev, [chapter.mangaId]: chapter.cover }), {})
        );
        setChapters(json);
      });
  }, [user]);

  useEffect(() => {
    getServices()
      .then(json => setServices(
        json.reduce((prev, service) => ({ ...prev, [service.serviceId]: service }), {})
      ));
  }, []);

  const GroupComponent = useMemo(() => ChapterGroupWithCover(mangaToCover || {}),
    [mangaToCover]);

  // eslint-disable-next-line react/no-unstable-nested-components
  const ChapterComponent = useMemo(() => ChapterWithLink(services || {}), [services]);

  return (
    <Container maxWidth='lg' sx={{ minHeight: '50vh' }}>
      <Typography variant='h4' sx={{ m: 1 }}>Recent Releases {user ? '(for your follows)' : ''}</Typography>
      <GroupedChapterList
        chapters={services ? chapters : []}
        groupKey='mangaId'
        groupToString={getGroupName}
        ChapterComponent={ChapterComponent}
        GroupComponent={GroupComponent}
        skeletons={limit}
      />
    </Container>

  );
}

export default App;
