import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
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
import Image from 'next/image';
import NextLink from 'next/link';
import { useCSRF } from '../utils/csrf';

import { defaultDateDistanceToNow, followUnfollow } from '../utils/utilities';
import { nextImageFix } from '../../utils/theme';


const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    padding: theme.spacing(2),
  },
  followTitle: {
    paddingTop: theme.spacing(2),
    paddingLeft: theme.spacing(2),
  },
  followContent: {
    display: 'flex',
    justifyContent: 'center',
  },
  followDetails: {
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: theme.spacing(2),
  },
  thumbnail: {
    width: '100%',
    maxWidth: '256px',
    [theme.breakpoints.down('xs')]: {
      maxWidth: '192px',
    },
    ...nextImageFix,
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
  const csrf = useCSRF();
  const columnsXs = 1;
  const columnsMd = 2;

  const renderFollow = (follow) => {
    const followedServices = follow.followedServices;

    return (
      <Grid item xs={12/columnsXs} md={12/columnsMd} key={follow.mangaId}>
        <Typography
          className={classes.followTitle}
          variant='h4'
          align='center'
        >
          {follow.title}
        </Typography>
        <div className={classes.followContent}>
          <div className={classes.thumbnail}>
            <NextLink href='/manga/[id]' as={`/manga/${follow.mangaId}`} passHref>
              <a target='_blank'>
                <Image
                  src={`${follow.cover}.256.jpg`}
                  alt={follow.title}
                  layout='fill'
                  objectFit='contain'
                  sizes='(max-width: 600px) 192px, 256px'
                />
              </a>
            </NextLink>
          </div>
          <div className={classes.followDetails}>
            <table>
              <tbody>
                <tr>
                  <td>
                    <Typography>Latest release: </Typography>
                  </td>
                  <td>
                    <Typography>
                      {defaultDateDistanceToNow(new Date(follow.latestRelease))}
                    </Typography>
                  </td>
                </tr>
                <tr>
                  <td>
                    <Typography>Latest chapter: </Typography>
                  </td>
                  <td>
                    <Typography>{follow.latestChapter || 'No chapters'}</Typography>
                  </td>
                </tr>
              </tbody>
            </table>
            <List className={classes.serviceList}>
              <ListItem key='all_services' className={classes.followService} disableGutters>
                <ListItemText primary='All services' className={classes.serviceName} />
                <Button variant='contained' color='primary' onClick={followUnfollow(csrf, follow.mangaId)}>
                  {followedServices.indexOf(null) < 0 ? 'Follow' : 'Unfollow'}
                </Button>
              </ListItem>
              {follow.services.map((service) => (
                <ListItem key={service.serviceId} className={classes.followService} disableGutters>
                  <ListItemText primary={service.serviceName} className={classes.serviceName} />
                  <Button variant='contained' color='primary' onClick={followUnfollow(csrf, follow.mangaId, service.serviceId)}>
                    {followedServices.indexOf(service.serviceId) < 0 ? 'Follow' : 'Unfollow'}
                  </Button>
                </ListItem>
              ))}
            </List>
          </div>
        </div>
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
