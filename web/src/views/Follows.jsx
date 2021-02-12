import React from 'react';

import {
  Container,
  IconButton,
  Paper,
  Typography,
} from '@material-ui/core';
import { lighten, makeStyles } from '@material-ui/core/styles';
import {
  RssFeed as RssFeedIcon,
} from '@material-ui/icons';
import PropTypes from 'prop-types';

import FollowsComponent from '../components/Follows';
import { useUser } from '../utils/useUser';


const useStyles = makeStyles((theme) => ({
  followCard: {
    height: '100%',
    overflow: 'hidden',
    marginBottom: theme.spacing(2),
    backgroundColor: lighten(theme.palette.background.paper, 0.05),
  },
  title: {
    marginLeft: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  rssLink: {
    alignSelf: 'center',
    height: '100%',
  },
}));

const Follows = (props) => {
  const classes = useStyles();
  const { user } = useUser();

  return (
    <Container maxWidth='lg'>
      <Paper className={classes.followCard}>
        <div className={classes.topRow}>
          <Typography variant='h2' className={classes.title}>
            Follows
          </Typography>
          <IconButton
            href={`/rss/${user.uuid.replace(/-/g, '')}`}
            target='_blank'
            className={classes.rssLink}
            size='medium'
            aria-label='Follows RSS feed'
          >
            <RssFeedIcon fontSize='large' />
          </IconButton>
        </div>
        <FollowsComponent {...props} />
      </Paper>
    </Container>
  );
};

Follows.propTypes = {
  follows: PropTypes.arrayOf(PropTypes.object),
};

export default Follows;
