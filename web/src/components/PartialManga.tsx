import React from 'react';
import { Grid, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import type { FullMangaData } from '@/types/api/manga';


import { MangaCover } from './MangaCover';
import MangaInfo from './MangaInfo';
import MangaSourceList from './MangaSourceList';

const DetailsContainer = styled('div')({
  display: 'flex',
});

const MangaTitle = styled(Typography)(({ theme }) => ({
  width: '100%',
  textAlign: 'left',
  paddingBottom: '10px',
  [theme.breakpoints.down('md')]: {
    ...theme.typography.h6,
  },
}));

const SourceList = styled('div')(({ theme }) => ({
  marginLeft: theme.spacing(3),
}));

export type PartialMangaProps = Partial<Pick<FullMangaData, 'manga' | 'services'>> & {
  showId?: boolean
};
function PartialManga(props: PartialMangaProps) {
  const {
    showId = false,
    manga,
    services,
  } = props;

  if (!manga || !manga.mangaId) return null;

  return (
    <div>
      <MangaTitle variant='h5' aria-label='manga title'>{manga.title}</MangaTitle>
      <DetailsContainer>
        <a href={`/manga/${manga.mangaId}`} target='_blank' rel='noopener noreferrer'>
          <MangaCover
            url={manga.cover}
            alt={manga.title}
          />
        </a>
        <Grid
          container
          direction='column'
          sx={{
            justifyContent: 'space-between',
          }}
        >
          <MangaInfo mangaData={manga} showId={showId} />
          <SourceList>
            <MangaSourceList
              items={services}
              openByDefault
            />
          </SourceList>
        </Grid>
      </DetailsContainer>
    </div>
  );
}

export default PartialManga;
