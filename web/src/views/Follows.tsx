import React from 'react';

import { Container, IconButton, Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import PropTypes from 'prop-types';

import FollowsComponent, { type FollowProps } from '../components/Follows';
import { useUser } from '../utils/useUser';

const FollowCard = styled(Paper)(({ theme }) => ({
  height: '100%',
  overflow: 'hidden',
  marginBottom: theme.spacing(2),
  backgroundColor: theme.vars.palette.AppBar.defaultBg,
}));

const TopRow = styled('div')({
  display: 'flex',
  justifyContent: 'space-between',
});

const Follows = (props: FollowProps) => {
  const { user } = useUser();

  return (
    <Container maxWidth='lg'>
      <FollowCard>
        <TopRow>
          <Typography variant='h2' sx={{ ml: 2, mt: 2 }}>
            Follows
          </Typography>
          <IconButton
            href={`/rss/${user!.uuid.replace(/-/g, '')}`}
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
