import React, { FC, useCallback, useState } from 'react';
import ArrowRightAlt from '@mui/icons-material/ArrowRightAlt';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';

import Search, { RenderListOption } from '@/components/MangaSearch';
import PartialManga from '@/components/PartialManga';
import type {
  FullMangaData,
  SearchedManga,
  SearchedMangaWithService,
} from '@/types/api/manga';

import { getManga, postMergeManga } from '../api/manga';

type MergeResult = {
  message?: string
  error?: boolean
};

const PREFIX = 'MergeManga';
const classes = {
  searchInput: `${PREFIX}-searchInput`,
  inputRoot: `${PREFIX}-inputRoot`,
};

const MangaView = styled('div')({
  width: '48%',
  minWidth: 'max-content',

  [`& .${classes.searchInput}`]: {
    width: '100%',
    marginLeft: '1em',
  },

  [`& .${classes.inputRoot}`]: {
    width: '100%',
    color: 'inherit',
  },
});

const MergeArrowBox = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
});

const MergeArrowText = styled(Typography)({
  margin: '0 24px',
  width: '50%',
});


type ServicesListProps = {
  services: { name: string, serviceId: number }[] | null
  value: 'all' | number | string
  setValue: (value: number | string) => void
};
const ServicesList: FC<ServicesListProps> = ({ services, value, setValue }) => {
  if (!services) return null;

  return (
    <FormControl component='fieldset'>
      <FormLabel component='legend'>Services</FormLabel>
      <RadioGroup aria-label='merge services' value={value} onChange={e => setValue(e.target.value)}>
        <FormControlLabel control={<Radio />} label='All services' value='all' />
        {services.map(service => (
          <FormControlLabel
            control={<Radio />}
            label={service.name}
            value={service.serviceId.toString()}
            key={service.serviceId}
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
};

const renderListOption: RenderListOption<SearchedMangaWithService> =
  ({ key, ...renderProps }, { title, services: mangaServices }) => (
    <Box key={key} component='li' {...renderProps}>
      <Box sx={{ width: '100%' }}>
        {title} | {Object.values(mangaServices).join(' | ')}
      </Box>
    </Box>
  );

function MergeManga() {
  const [manga1, setManga1] = useState<FullMangaData | null>(null);
  const [manga2, setManga2] = useState<FullMangaData | null>(null);
  const [result, setResult] = useState<MergeResult>({});
  const [radio, setRadio] = useState<'all' | number | string>('all');
  const isValid = manga1?.manga.mangaId
    && manga2?.manga.mangaId
    && manga1.manga.mangaId !== manga2.manga.mangaId;

  const getMangaData = (mangaId: number, setManga: (manga: FullMangaData) => void) => {
    getManga(mangaId)
      .then(data => setManga(data));
  };

  const onManga1Select = useCallback(({ mangaId }: SearchedManga) => {
    getMangaData(mangaId, setManga1);
  }, []);
  const onManga2Select = useCallback(({ mangaId }: SearchedManga) => {
    getMangaData(mangaId, setManga2);
  }, []);

  const mergeManga = () => {
    if (!isValid) return;

    const service = radio === 'all' ? undefined : radio;
    return postMergeManga(manga1.manga.mangaId, manga2.manga.mangaId, service)
      .then(json => {
        setResult({ message: `Moved ${json.aliasCount} alias(es) and ${json.chapterCount} chapter(s)` });
        setManga2(null);
      })
      .catch(err => setResult({ error: true, message: err.message }))
      .finally(() => setRadio('all'));
  };

  return (
    <Container
      maxWidth='xl'
      component={Paper}
      sx={{
        minHeight: '400px',
        minWidth: '900px',
        padding: 2,
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <Grid
        container
        justifyContent='space-between'
        wrap='nowrap'
      >
        <MangaView>
          <Search
            id='base-manga-search'
            inputClasses={{
              input: classes.searchInput,
              root: classes.inputRoot,
            }}
            popperProps={{
              placement: 'bottom-start',
            }}
            renderItem={renderListOption}
            ariaLabel='search base manga'
            onChange={onManga1Select}
            withServices
          />
          {manga1?.manga && (
            <section aria-label='base manga'>
              <PartialManga manga={manga1.manga} services={manga1.services} showId />
            </section>
          )}
        </MangaView>
        <MangaView>
          <Search
            id='to-merge-manga-search'
            inputClasses={{
              input: classes.searchInput,
              root: classes.inputRoot,
            }}
            popperProps={{
              placement: 'bottom-start',
            }}
            renderItem={renderListOption}
            ariaLabel='search manga to merge'
            onChange={onManga2Select}
            withServices
          />
          {manga2?.manga && (
            <section aria-label='manga to merge'>
              <PartialManga manga={manga2.manga} services={manga2.services} showId />
            </section>
          )}
        </MangaView>
      </Grid>
      <Grid container direction='column' alignItems='center' sx={{ p: 2, textAlign: 'center' }}>
        {isValid && (
          <>
            <ServicesList
              services={manga2.services}
              value={radio}
              setValue={setRadio}
            />
            <Button
              variant='contained'
              color='primary'
              id='merge-button'
              onClick={mergeManga}
              aria-label={`merge ${manga2.manga.title} into ${manga1.manga.title}`}
            >
              Merge
            </Button>
            <MergeArrowBox aria-hidden='true'>
              <MergeArrowText align='right'>
                {manga1.manga.title}
              </MergeArrowText>
              <ArrowRightAlt transform='rotate(180)' sx={{ position: 'absolute' }} />
              <MergeArrowText align='left'>
                {manga2.manga.title}
              </MergeArrowText>
            </MergeArrowBox>
          </>
        )}
        <Typography
          sx={{ mt: 2, color: result.error ? 'error' : 'initial' }}
          aria-label='merge result'
        >
          {result.message || null}
        </Typography>
      </Grid>
    </Container>
  );
}
export default MergeManga;
