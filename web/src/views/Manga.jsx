import fetch from 'cross-fetch';
import React from 'react';
import Typography from '@material-ui/core/Typography';
import Container from '@material-ui/core/Container';
import {makeStyles} from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper'
import Grid from '@material-ui/core/Grid'
import Tooltip from "@material-ui/core/Tooltip";
import Link from "@material-ui/core/Link";
import MangaSourceList from "../components/MangaSourceList";
import throttle from 'lodash.throttle';

const useStyles = makeStyles((theme) => ({
  title: {
    width: '75%',
    textAlign: 'left',
    paddingBottom: '10px',
    [theme.breakpoints.down('sm')]:{
      ...theme.typography.h5,
      width: '100%'
    }
  },
  thumbnail: {
    maxWidth: '250px',
    maxHeight: '355px',
    [theme.breakpoints.down('sm')]: {
      width: '75%'
    }
  },
  details: {
    display: 'flex',
  },
  detailText: {
    marginLeft: '5px'
  },
  infoTable : {
    marginLeft: '30px',
    marginTop: '3px',
  },
  paper: {
    padding: '1em',
  }
}));

const dateOptions = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };


function Manga (props) {
  const {
    mangaData,
    isAuthenticated = false,
    userFollows = [],
  } = props;

  const classes = useStyles();
  const latest_release = mangaData.latest_release ?
      new Date(mangaData.latest_release) :
      null;

  const estimated_release = mangaData.estimated_release ?
    new Date(mangaData.estimated_release) :
    null;

  const mangaChapters = React.useMemo(() => {
    if (!mangaData.chapters) return null;
    const serviceMap = {};
    mangaData.services.forEach(service => serviceMap[service.service_id] = service.url_format)
    return mangaData.chapters.map(chapter => {
      chapter.release_date = chapter.release_date ? new Date(chapter.release_date).toLocaleString('en-GB', dateOptions) : 'Unknown';
      chapter.url = serviceMap[chapter.service_id].replace('{}', chapter.chapter_url);
      return chapter
    })
  }, [mangaData.manga_id, mangaData.chapters?.length])

  const followUnfollow = (service_id) => {
    const url = service_id ? `/api/user/follows?manga_id=${mangaData.manga_id}&service_id=${service_id}` :
                             `/api/user/follows?manga_id=${mangaData.manga_id}`;
    return throttle((event) => {
      const target = event.target;
      switch (target.textContent.toLowerCase()) {
        case 'follow':
          fetch(url, {credentials: 'include', method: 'put'})
              .then(res => {
                if (res.status === 200) {
                  target.textContent = 'Unfollow';
                }
              });
          break;

        case "unfollow":
          fetch(url, {credentials: 'include', method: 'delete'})
              .then(res => {
                if (res.status === 200) {
                  target.textContent = 'Follow';
                }
              });
          break;

        default:
          target.textContent = 'Follow';
          return;
      }
    }, 200, {trailing: false});
  }

  return (
    <Container maxWidth='lg'>
      <Paper className={classes.paper}>
        <Typography className={classes.title} variant='h4'>{mangaData.title}</Typography>
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
          >
            <table className={classes.infoTable}>
              <tbody>
                <tr>
                  <td><Typography>Latest release:</Typography></td>
                  <td>
                    <Tooltip title={latest_release ? latest_release.toUTCString() : 'Unknown'}>
                      <Typography className={classes.detailText}>
                        {(latest_release ? latest_release.toLocaleString('en-GB', dateOptions) : 'Unknown')}
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
            <MangaSourceList
                items={mangaData.services}
                userFollows={userFollows}
                isAuthenticated={isAuthenticated}
                followUnfollow={followUnfollow}
            />
          </Grid>
        </div>
        {isAuthenticated &&
          <Button variant='contained' color='primary' onClick={followUnfollow(null)}>
            {userFollows.indexOf(null) < 0 ? 'Follow' : 'Unfollow'}
          </Button>}

        {mangaChapters && mangaChapters.length > 0 &&
        <TableContainer component={Paper}>
          <Table className={classes.table} aria-label='simple table'>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Chapter</TableCell>
                <TableCell>Released</TableCell>
                <TableCell>Group</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mangaChapters.map((row, index) => (
                <TableRow key={index}>
                  <TableCell component='th' scope='row'>
                    <Link href={row.url} target='_blank' style={{textDecoration: 'none'}}>
                      <div>
                        {row.title}
                      </div>
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
        }
      </Paper>
    </Container>
  );
}

export default Manga;