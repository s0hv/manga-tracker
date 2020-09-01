import React, { useCallback, useState } from 'react';
import {
  Button,
  Container,
  Grid, IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

import { Edit as EditIcon } from '@material-ui/icons';
import MangaSourceList from './MangaSourceList';
import {
  defaultDateDistanceToNow,
  defaultDateFormat,
  followUnfollow,
} from '../utils/utilities';
import ChapterList from './ChapterList';
import { useUser } from '../utils/useUser';


const useStyles = makeStyles((theme) => ({
  title: {
    width: '75%',
    textAlign: 'left',
    paddingBottom: '10px',
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
  },
  titleBar: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  thumbnail: {
    maxWidth: '250px',
    maxHeight: '355px',
    [theme.breakpoints.down('sm')]: {
      maxWidth: '180px',
    },
    [theme.breakpoints.down('xs')]: {
      maxWidth: '125px',
    },
  },
  details: {
    display: 'flex',
  },
  detailText: {
    marginLeft: '5px',
    [theme.breakpoints.down('sm')]: {
      marginLeft: '3px',
    },
  },
  infoTable: {
    marginLeft: '30px',
    marginTop: '3px',
    [theme.breakpoints.down('sm')]: {
      marginLeft: '20px',
    },
    [theme.breakpoints.down('xs')]: {
      marginLeft: '10px',
    },
  },
  sourceList: {
    marginLeft: '35px',
    [theme.breakpoints.down('sm')]: {
      marginLeft: '23px',
    },
    [theme.breakpoints.down('xs')]: {
      marginLeft: '13px',
    },
  },
  followButton: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  paper: {
    padding: '1em',
    minWidth: '440px',
  },
}));


function Manga(props) {
  const {
    mangaData,
    userFollows = [],
  } = props;

  const { isAuthenticated, user } = useUser();

  const classes = useStyles();
  const [editing, setEditing] = useState(false);
  const startEditing = useCallback(() => setEditing(!editing), [editing]);

  const latestRelease = mangaData.latest_release ?
    new Date(mangaData.latest_release) :
    null;

  const estimatedRelease = new Date(mangaData.estimated_release);

  const mangaChapters = React.useMemo(() => {
    if (!mangaData.chapters) return null;
    const serviceMap = {};
    mangaData.services.forEach(service => { serviceMap[service.service_id] = service.url_format });
    return mangaData.chapters.map(chapter => {
      const newChapter = { ...chapter };
      newChapter.release_date = new Date(chapter.release_date);
      newChapter.url = serviceMap[chapter.service_id].replace('{}', chapter.chapter_url);
      return newChapter;
    });
  }, [mangaData.chapters, mangaData.services]);

  return (
    <Container maxWidth='lg'>
      <Paper className={classes.paper}>
        <div className={classes.titleBar}>
          <Typography className={classes.title} variant='h4'>{mangaData.title}</Typography>
          {user?.admin && (
            <IconButton onClick={startEditing}>
              <EditIcon />
            </IconButton>
          )}
        </div>
        <div className={classes.details}>
          <a href={mangaData.mal} target='_blank' rel='noreferrer noopener'>
            <img
              src={mangaData.cover}
              className={classes.thumbnail}
              alt={mangaData.title}
            />
          </a>
          <Grid
            container
            justify='space-between'
          >
            <table className={classes.infoTable}>
              <tbody>
                <tr>
                  <td><Typography>Latest release:</Typography></td>
                  <td>
                    <Tooltip title={latestRelease ? latestRelease.toUTCString() : 'Unknown'}>
                      <Typography className={classes.detailText}>
                        {latestRelease ?
                          defaultDateFormat(latestRelease) + ' - ' + defaultDateDistanceToNow(latestRelease) :
                          'Unknown'}
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
                      {defaultDateFormat(estimatedRelease)}
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
            <MangaSourceList
              classesProp={[classes.sourceList]}
              items={mangaData.services}
              userFollows={userFollows}
              followUnfollow={(serviceId) => followUnfollow(mangaData.manga_id, serviceId)}
            />
          </Grid>
        </div>
        {isAuthenticated && (
          <Button
            variant='contained'
            color='primary'
            onClick={followUnfollow(mangaData.manga_id, null)}
            className={classes.followButton}
          >
            {userFollows.indexOf(null) < 0 ? 'Follow' : 'Unfollow'}
          </Button>
        )}

        <ChapterList
          chapters={mangaChapters}
          editable={editing}
        />
      </Paper>
    </Container>
  );
}

export default Manga;
