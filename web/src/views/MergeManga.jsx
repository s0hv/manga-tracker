import {
  Button,
  Container,
  Grid,
  Paper,
  Typography,
  RadioGroup,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
} from '@mui/material';
import { ArrowRightAlt } from '@mui/icons-material';

import { styled } from '@mui/material/styles';
import React, { useState, useCallback } from 'react';
/** @jsxImportSource @emotion/react */
import Search from '../components/MangaSearch';
import PartialManga from '../components/PartialManga';
import { useCSRF } from '../utils/csrf';
import { getManga, postMergeManga } from '../api/manga';


const RootContainer = styled(Container)(({ theme }) => ({
  minHeight: '400px',
  minWidth: '900px',
  padding: theme.spacing(2),
  overflow: 'auto',
  position: 'relative',
}));

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


const ServicesList = ({ services, value, setValue }) => {
  if (!services) return null;

  return (
    <FormControl component='fieldset'>
      <FormLabel component='legend'>Services</FormLabel>
      <RadioGroup aria-label='merge services' value={value} onChange={(e) => setValue(e.target.value)}>
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


function MergeManga() {
  const csrf = useCSRF();

  const [manga1, setManga1] = useState({});
  const [manga2, setManga2] = useState({});
  const [result, setResult] = useState({});
  const [radio, setRadio] = useState('all');
  const isValid = manga1.manga?.mangaId && manga2.manga?.mangaId && manga1.manga.mangaId !== manga2.manga.mangaId;

  const getMangaData = (mangaId, setManga) => {
    getManga(mangaId)
      .then(data => setManga(data));
  };

  const onManga1Select = useCallback(({ mangaId }) => {
    getMangaData(mangaId, setManga1);
  }, []);
  const onManga2Select = useCallback(({ mangaId }) => {
    getMangaData(mangaId, setManga2);
  }, []);

  const mergeManga = () => {
    if (!isValid) return;

    const service = radio === 'all' ? undefined : radio;
    postMergeManga(csrf, manga1.manga.mangaId, manga2.manga.mangaId, service)
      .then(json => {
        setResult({ message: `Moved ${json.aliasCount} alias(es) and ${json.chapterCount} chapter(s)` });
        setManga2({});
      })
      .catch(err => setResult({ error: true, message: err.message }))
      .finally(() => setRadio('all'));
  };

  const renderItem = useCallback((renderProps, { title }, index, props) => (
    <li {...renderProps}>
      <div
        {...props}
        // eslint-disable-next-line react/no-unknown-property
        css={{ width: '100%' }}
      >
        {title}
      </div>
    </li>
  ), []);

  return (
    <RootContainer maxWidth='xl' component={Paper}>
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
            renderItem={renderItem}
            ariaLabel='search base manga'
            onChange={onManga1Select}
          />
          {manga1.manga && (
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
            renderItem={renderItem}
            ariaLabel='search manga to merge'
            onChange={onManga2Select}
          />
          {manga2.manga && (
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
          color={result.error ? 'error' : 'initial'}
          sx={{ mt: 2 }}
          aria-label='merge result'
        >
          {result.message || null}
        </Typography>
      </Grid>
    </RootContainer>
  );
}
export default MergeManga;
