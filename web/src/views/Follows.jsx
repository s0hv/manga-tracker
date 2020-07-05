import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
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
import chunk from 'lodash.chunk';

import {followUnfollow} from '../utils/utilities';


const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    padding: theme.spacing(2),
  },
  followCard: {
    height: '100%',
    overflow: 'hidden',
  },
  followTitle: {
    paddingTop: theme.spacing(2),
    paddingLeft: theme.spacing(2),
  },
  followContent: {
    display: 'flex',
  },
  thumbnail: {
    maxWidth: '200px',
    height: '250px',
    [theme.breakpoints.down('sm')]: {
      maxWidth: '180px',
    },
    [theme.breakpoints.down('xs')]: {
      maxWidth: '125px',
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
  const rowWidth = 2;

  const renderFollow = (follow) => {
    const followedServices = follow.followed_services;

    return (
      <Grid item xs={12/rowWidth} key={follow.manga_id}>
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
            <List className={classes.serviceList}>
              <ListItem key='0' className={classes.followService}>
                <ListItemText primary='All services' className={classes.serviceName} />
                <Button variant='contained' color='primary' onClick={followUnfollow(follow.manga_id)}>
                  {followedServices.indexOf(null) < 0 ? 'Follow' : 'Unfollow'}
                </Button>
              </ListItem>
              {follow.services.map((service, index) => (
                <ListItem key={`${index+1}`} className={classes.followService}>
                  <ListItemText primary={service.service_name} className={classes.serviceName} />
                  <Button variant='contained' color='primary' onClick={followUnfollow(follow.manga_id, service.service_id)}>
                    {followedServices.indexOf(service.service_id) < 0 ? 'Follow' : 'Unfollow'}
                  </Button>
                </ListItem>
                ))}
            </List>
          </div>
        </Paper>
      </Grid>
    );
  };

  return (

    <Container maxWidth='lg'>
      <Paper className={classes.root}>
        <Grid container spacing={1}>
          {chunk(follows, rowWidth).map((rowFollows, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <Grid container item xs={12} spacing={3} key={index}>
              {rowFollows.map(renderFollow)}
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Container>
  );
}

export default Follows;
