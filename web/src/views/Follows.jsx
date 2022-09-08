import React from 'react';

import { Container, IconButton, Paper, Typography } from '@mui/material';
import { lighten, styled } from '@mui/material/styles';
import { RssFeed as RssFeedIcon } from '@mui/icons-material';
import PropTypes from 'prop-types';

import FollowsComponent from '../components/Follows';
import { useUser } from '../utils/useUser';

const FollowCard = styled(Paper)(({ theme }) => ({
  height: '100%',
  overflow: 'hidden',
  marginBottom: theme.spacing(2),
  backgroundColor: lighten(theme.palette.background.paper, 0.05),
}));

const TopRow = styled('div')({
  display: 'flex',
  justifyContent: 'space-between',
});

const Follows = (props) => {
  const { user } = useUser();

  return (
    <Container maxWidth='lg'>
      <FollowCard>
        <TopRow>
          <Typography variant='h2' sx={{ ml: 2, mt: 2 }}>
            Follows
          </Typography>
          <IconButton
            href={`/rss/${user.uuid.replace(/-/g, '')}`}
            target='_blank'
            sx={{ alignSelf: 'center', height: '100%' }}
            size='medium'
            aria-label='Follows RSS feed'
          >
            <RssFeedIcon fontSize='large' />
          </IconButton>
        </TopRow>
        <FollowsComponent {...props} />
      </FollowCard>
    </Container>
  );
};

Follows.propTypes = {
  follows: PropTypes.arrayOf(PropTypes.object),
};

export default Follows;
