import React from 'react';
import {
  Button,
  Container,
  Grid,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

import MangaSourceList from '../components/MangaSourceList';
import { followUnfollow } from '../utils/utilities';


const useStyles = makeStyles((theme) => ({
  title: {
    width: '75%',
    textAlign: 'left',
    paddingBottom: '10px',
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
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
  titleColumn: {
    minWidth: '225px',
  },
  releaseColumn: {
    minWidth: '200px',
  },
}));

const dateOptions = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };


function Manga(props) {
  const {
    mangaData,
    isAuthenticated = false,
    userFollows = [],
  } = props;

  const classes = useStyles();
  const latestRelease = mangaData.latest_release ?
      new Date(mangaData.latest_release) :
      null;

  const estimatedRelease = mangaData.estimated_release ?
    new Date(mangaData.estimated_release) :
    null;

  const mangaChapters = React.useMemo(() => {
    if (!mangaData.chapters) return null;
    const serviceMap = {};
    mangaData.services.forEach(service => { serviceMap[service.service_id] = service.url_format });
    return mangaData.chapters.map(chapter => {
      const newChapter = { ...chapter };
      newChapter.release_date = chapter.release_date ? new Date(chapter.release_date).toLocaleString('en-GB', dateOptions) : 'Unknown';
      newChapter.url = serviceMap[chapter.service_id].replace('{}', chapter.chapter_url);
      return newChapter;
    });
  }, [mangaData.chapters, mangaData.services]);

  return (
    <Container maxWidth='lg'>
      <Paper className={classes.paper}>
        <Typography className={classes.title} variant='h4'>{mangaData.title}</Typography>
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
                        {(latestRelease ? latestRelease.toLocaleString('en-GB', dateOptions) : 'Unknown')}
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
            <MangaSourceList
              classesProp={[classes.sourceList]}
              items={mangaData.services}
              userFollows={userFollows}
              isAuthenticated={isAuthenticated}
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

        {mangaChapters && mangaChapters.length > 0 && (
        <TableContainer component={Paper}>
          <Table className={classes.table} aria-label='simple table'>
            <TableHead>
              <TableRow>
                <TableCell className={classes.titleColumn}>Title</TableCell>
                <TableCell>Chapter</TableCell>
                <TableCell className={classes.releaseColumn}>Released</TableCell>
                <TableCell>Group</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mangaChapters.map((row, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <TableRow key={index}>
                  <TableCell component='th' scope='row'>
                    <Link href={row.url} target='_blank' style={{ textDecoration: 'none' }}>
                      <span>
                        {row.title}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>{row.chapter_number}</TableCell>
                  <TableCell>{row.release_date}</TableCell>
                  <TableCell>{row.group}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      </Paper>
    </Container>
  );
}

export default Manga;
