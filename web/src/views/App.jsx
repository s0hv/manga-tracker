import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Typography, Container } from '@mui/material';
import { getLatestChapters } from '../api/chapter';
import { getServices } from '../api/services';
import {
  ChapterGroupWithCover,
  ChapterWithLink
} from '../components/GroupedChapterList';

const GroupedChapterList = dynamic(import('../components/GroupedChapterList'));

const getGroupName = (_, chapters) => chapters[0].manga;

function App() {
  const [chapters, setChapters] = useState([]);
  const [services, setServices] = useState(null);
  const [mangaToCover, setMangaToCover] = useState(null);

  useEffect(() => {
    getLatestChapters(25, 0)
      .then(json => {
        setMangaToCover(
          json.reduce((prev, chapter) => ({ ...prev, [chapter.mangaId]: chapter.cover }), {})
        );
        setChapters(json);
      });
  }, []);

  useEffect(() => {
    getServices()
      .then(json => setServices(
        json.reduce((prev, service) => ({ ...prev, [service.serviceId]: service }), {})
      ));
  }, []);

  const GroupComponent = useMemo(() => ChapterGroupWithCover(mangaToCover),
    [mangaToCover]);

  // eslint-disable-next-line react/no-unstable-nested-components
  const ChapterComponent = useMemo(() => ChapterWithLink(services), [services]);

  return (
    <Container maxWidth='lg'>
      <Typography variant='h4' sx={{ m: 1 }}>Recent Releases</Typography>
      <GroupedChapterList
        chapters={services ? chapters : []}
        groupKey='mangaId'
        groupToString={getGroupName}
        ChapterComponent={ChapterComponent}
        GroupComponent={GroupComponent}
      />
    </Container>

  );
}

function MainApp({ user }) {
  return (
    <App user={user} />
  );
}

export default MainApp;
