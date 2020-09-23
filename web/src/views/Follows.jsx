import React from 'react';
import { lighten, makeStyles } from '@material-ui/core/styles';
import {
  Button,
  Container,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from '@material-ui/core';
import NextLink from 'next/link';

import { defaultDateDistanceToNow, followUnfollow } from '../utils/utilities';


const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    padding: theme.spacing(2),
  },
  followCard: {
    height: '100%',
    overflow: 'hidden',
    marginBottom: theme.spacing(2),
    backgroundColor: lighten(theme.palette.background.paper, 0.05),
  },
  followTitle: {
    paddingTop: theme.spacing(2),
    paddingLeft: theme.spacing(2),
  },
  followContent: {
    display: 'flex',
  },
  followDetails: {
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: theme.spacing(2),
  },
  thumbnail: {
    paddingLeft: theme.spacing(2),
    maxWidth: '200px',
    height: '250px',
    [theme.breakpoints.down('sm')]: {
      maxWidth: '180px',
    },
    [theme.breakpoints.down('xs')]: {
      maxWidth: '145px',
      height: '175px',
    },
  },
  serviceList: {
    overflow: 'auto',
    maxHeight: '250px',
  },
  followService: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  serviceName: {
    marginRight: theme.spacing(2),
  },
}));

function Follows(props) {
  const {
    follows = [],
  } = props;

  const classes = useStyles();
  const columnsXs = 1;
  const columnsMd = 2;

  const renderFollow = (follow) => {
    const followedServices = follow.followed_services;

    return (
      <Grid item xs={12/columnsXs} md={12/columnsMd} key={follow.manga_id}>
        <Paper className={classes.followCard}>
          <Typography className={classes.followTitle}>{follow.title}</Typography>
          <div className={classes.followContent}>
            <NextLink href='/manga/[id]' as={`/manga/${follow.manga_id}`} passHref>
              <a target='_blank'>
                <img
                  src={follow.cover}
                  className={classes.thumbnail}
                  alt={follow.title}
                />
              </a>
            </NextLink>
            <div className={classes.followDetails}>
              <table>
                <tbody>
                  <tr>
                    <td>
                      <Typography>Latest release: </Typography>
                    </td>
                    <td>
                      <Typography>
                        {defaultDateDistanceToNow(new Date(follow.latest_release))}
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography>Latest chapter: </Typography>
                    </td>
                    <td>
                      <Typography>{follow.latest_chapter || 'No chapters'}</Typography>
                    </td>
                  </tr>
                </tbody>
              </table>
              <List className={classes.serviceList}>
                <ListItem key='all_services' className={classes.followService} disableGutters>
                  <ListItemText primary='All services' className={classes.serviceName} />
                  <Button variant='contained' color='primary' onClick={followUnfollow(follow.manga_id)}>
                    {followedServices.indexOf(null) < 0 ? 'Follow' : 'Unfollow'}
                  </Button>
                </ListItem>
                {follow.services.map((service) => (
                  <ListItem key={service.service_id} className={classes.followService} disableGutters>
                    <ListItemText primary={service.service_name} className={classes.serviceName} />
                    <Button variant='contained' color='primary' onClick={followUnfollow(follow.manga_id, service.service_id)}>
                      {followedServices.indexOf(service.service_id) < 0 ? 'Follow' : 'Unfollow'}
                    </Button>
                  </ListItem>
                ))}
              </List>
            </div>
          </div>
        </Paper>
      </Grid>
    );
  };

  return (

    <Container maxWidth='lg' disableGutters>
      <Paper className={classes.root}>
        <Grid container spacing={1}>
          {follows.map(renderFollow)}
        </Grid>
      </Paper>
    </Container>
  );
}

export default Follows;
