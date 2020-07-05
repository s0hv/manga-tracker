import React from 'react';
import {Grid, Tooltip, Typography} from '@material-ui/core';
import {makeStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';

import MangaSourceList from './MangaSourceList';

const dateOptions = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };

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
  detailText: {
    marginLeft: '5px',
  },
  infoTable: {
    marginLeft: theme.spacing(3),
    marginTop: '3px',
  },
  sourceList: {
    marginLeft: theme.spacing(3),
  },
  paper: {
    padding: '1em',
  },
}));

function PartialManga(props) {
  const {
    showId = false,
    mangaData,
  } = props;

  const classes = useStyles();

  if (!mangaData.manga_id) return null;

  const latestRelease = mangaData.latest_release ?
    new Date(mangaData.latest_release) :
    null;

  const estimatedRelease = mangaData.estimated_release ?
    new Date(mangaData.estimated_release) :
    null;

  return (
    <div>
      <Typography className={classes.title} variant='h5'>{mangaData.title}</Typography>
      <div className={classes.details}>
        <a href={mangaData.mal} target='_blank' rel='noopener noreferrer'>
          <img
            src={mangaData.cover}
            className={classes.thumbnail}
            alt={mangaData.title}
          />
        </a>
        <Grid
          container
          justify='space-between'
          direction='column'
        >
          <table className={classes.infoTable}>
            <tbody>
              { showId && (
              <tr>
                <td><Typography>Manga id:</Typography></td>
                <td><Typography className={classes.detailText}>{mangaData.manga_id}</Typography></td>
              </tr>
            )}
              <tr>
                <td><Typography>Latest release:</Typography></td>
                <td>
                  <Tooltip title={latestRelease ? latestRelease.toUTCString() : 'Unknown'}>
                    <Typography className={classes.detailText}>
                      {latestRelease ? latestRelease.toLocaleString('en-GB', dateOptions) : 'Unknown'}
                    </Typography>
                  </Tooltip>
                </td>
              </tr>
              <tr>
                <td><Typography>Estimated release interval:</Typography></td>
                <td>
                  <Typography className={classes.detailText}>
                    {(mangaData.release_interval ?
                        `${mangaData.release_interval?.days || 0} days ${mangaData.release_interval?.hours || 0} hours` :
                        'Unknown')}
                  </Typography>
                </td>
              </tr>
              <tr>
                <td><Typography>Estimated next release:</Typography></td>
                <td>
                  <Typography className={classes.detailText}>
                    {estimatedRelease ? estimatedRelease.toLocaleString('en-GB', dateOptions) : 'Unknown'}
                  </Typography>
                </td>
              </tr>
              <tr>
                <td><Typography>Latest chapter:</Typography></td>
                <td>
                  <Typography className={classes.detailText}>
                    {mangaData.latest_chapter ? mangaData.latest_chapter : 'Unknown'}
                  </Typography>
                </td>
              </tr>
            </tbody>
          </table>
          <div className={classes.sourceList}>
            <MangaSourceList
              items={mangaData.services}
              isAuthenticated={false}
            />
          </div>
        </Grid>

      </div>
    </div>
  );
}

PartialManga.propTypes = {
  showId: PropTypes.bool,
  mangaData: PropTypes.shape({
    services: PropTypes.arrayOf(PropTypes.object),
    manga_id: PropTypes.number,
    latest_chapter: PropTypes.number,
    latest_release: PropTypes.string,
    release_interval: PropTypes.shape({
      days: PropTypes.number,
      hours: PropTypes.number,
    }),
    estimated_release: PropTypes.string,
    mal: PropTypes.string,
    cover: PropTypes.string,
    title: PropTypes.string,
  }),
};

export default PartialManga;
