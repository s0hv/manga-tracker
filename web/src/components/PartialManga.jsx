import React from 'react';
import { Grid, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';

import MangaSourceList from './MangaSourceList';
import MangaInfo from './MangaInfo';

const useStyles = makeStyles((theme) => ({
  title: {
    width: '100%',
    textAlign: 'left',
    paddingBottom: '10px',
    [theme.breakpoints.down('sm')]: {
      ...theme.typography.h6,
    },
  },
  thumbnail: {
    maxWidth: '200px',
    maxHeight: '300px',
    [theme.breakpoints.down('sm')]: {
      maxWidth: '125px',
    },
  },
  details: {
    display: 'flex',
  },
  sourceList: {
    marginLeft: theme.spacing(3),
  },
}));

function PartialManga(props) {
  const {
    showId = false,
    manga,
    services,
  } = props;

  const classes = useStyles();

  if (!manga || !manga.mangaId) return null;

  return (
    <div>
      <Typography className={classes.title} variant='h5' aria-label='manga title'>{manga.title}</Typography>
      <div className={classes.details}>
        <a href={`/manga/${manga.mangaId}`} target='_blank' rel='noopener noreferrer'>
          <img
            src={manga.cover}
            className={classes.thumbnail}
            alt={manga.title}
          />
        </a>
        <Grid
          container
          justify='space-between'
          direction='column'
        >
          <MangaInfo mangaData={manga} showId={showId} />
          <div className={classes.sourceList}>
            <MangaSourceList
              items={services}
              openByDefault
            />
          </div>
        </Grid>
      </div>
    </div>
  );
}

PartialManga.propTypes = {
  showId: PropTypes.bool,
  manga: PropTypes.object,
  services: PropTypes.arrayOf(PropTypes.object),
};

export default PartialManga;
