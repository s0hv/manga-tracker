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
} from '@material-ui/core';
import { ArrowRightAlt } from '@material-ui/icons';

import { makeStyles } from '@material-ui/core/styles';
import React, { useState, useCallback } from 'react';

import Search from '../components/MangaSearch';
import PartialManga from '../components/PartialManga';
import { csrfHeader, useCSRF } from '../utils/csrf';

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: '400px',
    minWidth: '900px',
    padding: theme.spacing(2),
    overflow: 'auto',
    position: 'relative',
  },
  mangaView: {
    width: '48%',
    minWidth: 'max-content',
  },
  searchInput: {
    width: '100%',
    marginLeft: '1em',
  },
  inputRoot: {
    width: '100%',
    color: 'inherit',
  },
  mergeButton: {
    padding: theme.spacing(2),
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: theme.spacing(2),
  },
  listItem: {
    width: '100%',
  },
  mergeArrowBox: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  },
  mergeArrowText: {
    margin: '0 24px',
    width: '50%',
  },
  mergeArrowSvg: {
    position: 'absolute',
  },
}));


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
            value={service.service_id.toString()}
            key={service.service_id}
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
};


function MergeManga() {
  const classes = useStyles();
  const csrf = useCSRF();

  const [manga1, setManga1] = useState({});
  const [manga2, setManga2] = useState({});
  const [result, setResult] = useState({});
  const [radio, setRadio] = useState('all');
  const isValid = manga1.manga?.manga_id && manga2.manga?.manga_id && manga1.manga.manga_id !== manga2.manga.manga_id;

  const getMangaData = (mangaId, cb) => {
    fetch(`/api/manga/${mangaId}`)
      .then(res => res.json())
      .then(js => {
        cb(js.data);
      })
      .catch(err => {
        console.error(err);
        cb({});
      });
  };

  const onManga1Select = useCallback(({ manga_id: mangaId }) => {
    getMangaData(mangaId, setManga1);
  }, []);
  const onManga2Select = useCallback(({ manga_id: mangaId }) => {
    getMangaData(mangaId, setManga2);
  }, []);

  const mergeManga = () => {
    if (!isValid) return;

    const service = radio === 'all' ? '' : `&service=${radio}`;
    fetch(`/api/manga/merge/?base=${manga1.manga.manga_id}&to_merge=${manga2.manga.manga_id}${service}`,
      {
        credentials: 'include',
        method: 'post',
        headers: {
          ...csrfHeader(csrf),
        },
      })
      .then(res => {
        if (!res.ok) {
          setResult({ error: true, message: `${res.status} ${res.statusText}` });
          return;
        }
        return res.json();
      })
      .then(json => {
        if (!json) return;
        setResult({ message: `Moved ${json.alias_count} alias(es) and ${json.chapter_count} chapter(s)` });
        setManga2({});
      })
      .catch(err => setResult({ error: true, message: err.message }))
      .finally(() => setRadio('all'));
  };

  const renderItem = useCallback(({ title }, index, props) => (
    <div
      {...props}
      className={classes.listItem}
    >
      {title}
    </div>
  ), [classes.listItem]);

  return (
    <Container maxWidth='xl' component={Paper} className={classes.root}>
      <Grid
        container
        justify='space-between'
        wrap='nowrap'
      >
        <div className={classes.mangaView}>
          <Search
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
        </div>
        <div className={classes.mangaView}>
          <Search
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
        </div>
      </Grid>
      <Grid className={classes.mergeButton} container direction='column' alignItems='center'>
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
            <div className={classes.mergeArrowBox} aria-hidden='true'>
              <Typography className={classes.mergeArrowText} align='right'>
                {manga1.manga.title}
              </Typography>
              <ArrowRightAlt transform='rotate(180)' className={classes.mergeArrowSvg} />
              <Typography className={classes.mergeArrowText} align='left'>
                {manga2.manga.title}
              </Typography>
            </div>
          </>
        )}
        <Typography
          color={result.error ? 'error' : 'initial'}
          className={classes.errorMessage}
        >
          {result.message || null}
        </Typography>
      </Grid>
    </Container>
  );
}
export default MergeManga;
