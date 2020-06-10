import React from 'react';
import {Grid, makeStyles, Tooltip, Typography,} from '@material-ui/core';
import MangaSourceList from "./MangaSourceList";

const dateOptions = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };

const useStyles = makeStyles((theme) => ({
  title: {
    width: '100%',
    textAlign: 'left',
    paddingBottom: '10px',
    [theme.breakpoints.down('sm')]:{
      ...theme.typography.h6,
    }
  },
  thumbnail: {
    maxWidth: '200px',
    maxHeight: '300px',
    [theme.breakpoints.down('sm')]: {
      maxWidth: '125px'
    }
  },
  details: {
    display: 'flex',
  },
  detailText: {
    marginLeft: '5px'
  },
  infoTable : {
    marginLeft: theme.spacing(3),
    marginTop: '3px',
  },
  sourceList: {
    marginLeft: theme.spacing(3),
  },
  paper: {
    padding: '1em',
  }
}));

function PartialManga(props) {
  const {
    showId = false,
    mangaData,
  } = props;

  if (!mangaData.manga_id) return null;

  const classes = useStyles();
  const latest_release = mangaData.latest_release ?
    new Date(mangaData.latest_release) :
    null;

  const estimated_release = mangaData.estimated_release ?
    new Date(mangaData.estimated_release) :
    null;

  return (
    <div>
      <Typography className={classes.title} variant='h5'>{mangaData.title}</Typography>
      <div className={classes.details}>
        <a href={mangaData.mal} target='_blank'>
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
            { showId &&
              <tr>
                <td><Typography>Manga id:</Typography></td>
                <td><Typography className={classes.detailText}>{mangaData.manga_id}</Typography></td>
              </tr>
            }
              <tr>
                <td><Typography>Latest release:</Typography></td>
                <td>
                  <Tooltip title={latest_release ? latest_release.toUTCString() : 'Unknown'}>
                    <Typography className={classes.detailText}>
                      {latest_release ? latest_release.toLocaleString('en-GB', dateOptions) : 'Unknown'}
                    </Typography>
                  </Tooltip>
                </td>
              </tr>
              <tr>
                <td><Typography>Estimated release interval:</Typography></td>
                <td>
                  <Typography className={classes.detailText}>
                    {(mangaData.release_interval ?
                        `${mangaData.release_interval?.days || 0} days ${mangaData.release_interval?.hours || 0} hours`
                        : 'Unknown')}
                  </Typography>
                </td>
              </tr>
              <tr>
                <td><Typography>Estimated next release:</Typography></td>
                <td>
                  <Typography className={classes.detailText}>
                    {estimated_release ? estimated_release.toLocaleString('en-GB', dateOptions) : 'Unknown'}
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

export default PartialManga;