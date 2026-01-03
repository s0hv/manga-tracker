import React from 'react';
import {
  type SxProps,
  Button,
  Container,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';

import { RouteLink } from '@/components/common/RouteLink';
import { MangaCover } from '@/components/MangaCover';
import type { Follow } from '@/types/db/follows';

import { nextImageFix } from '../utils/theme';
import { defaultDateDistanceToNow, followUnfollow } from '../utils/utilities';


const FollowContent = styled('div')({
  display: 'flex',
  justifyContent: 'center',
});

const FollowDetails = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  paddingLeft: theme.spacing(2),
}));

const Thumbnail = styled('div')(({ theme }) => ({
  width: '100%',
  position: 'relative',
  height: '256px',
  maxWidth: '256px',
  [theme.breakpoints.down('sm')]: {
    maxWidth: '192px',
  },
  ...nextImageFix,
}));

const serviceNameText = { mr: 2 };
const followServiceItem = { display: 'flex', justifyContent: 'space-between' };
const mangaLinkStyles = { display: 'flex', height: '100%', position: 'relative' } satisfies SxProps;

export type FollowProps = {
  follows?: Follow[]
};


function Follows(props: FollowProps) {
  const {
    follows = [],
  } = props;

  const columnsXs = 1;
  const columnsMd = 2;

  const renderFollow = (follow: Follow) => {
    const followedServices = follow.followedServices;

    return (
      <Grid
        key={follow.mangaId}
        size={{
          xs: 12 / columnsXs,
          md: 12 / columnsMd,
        }}
      >
        <Typography
          sx={{ pt: 2, pl: 2 }}
          variant='h4'
          align='center'
        >
          {follow.title}
        </Typography>
        <FollowContent>
          <Thumbnail>
            <RouteLink
              to='/manga/$mangaId'
              params={{ mangaId: follow.mangaId.toString() }}
              target='_blank'
              sx={mangaLinkStyles}
            >
              <MangaCover
                url={follow.cover}
                alt={follow.title}
              />
            </RouteLink>
          </Thumbnail>
          <FollowDetails>
            <table>
              <tbody>
                <tr>
                  <th>
                    <Typography>Latest release: </Typography>
                  </th>
                  <td>
                    <Typography>
                      {defaultDateDistanceToNow(new Date(follow.latestRelease || 0))}
                    </Typography>
                  </td>
                </tr>
                <tr>
                  <th>
                    <Typography>Latest chapter: </Typography>
                  </th>
                  <td>
                    <Typography>{follow.latestChapter || 'No chapters'}</Typography>
                  </td>
                </tr>
              </tbody>
            </table>
            <List sx={{ overflow: 'auto', maxHeight: '250px' }} aria-label='manga services'>
              <ListItem key='all_services' disableGutters sx={followServiceItem}>
                <ListItemText primary='All services' sx={serviceNameText} />
                <Button variant='contained' color='primary' onClick={followUnfollow(follow.mangaId, null)}>
                  {followedServices.indexOf(null) < 0 ? 'Follow' : 'Unfollow'}
                </Button>
              </ListItem>
              {follow.services.map(service => (
                <ListItem key={service.serviceId} sx={followServiceItem} disableGutters>
                  <ListItemText primary={service.serviceName} sx={serviceNameText} />
                  <Button variant='contained' color='primary' onClick={followUnfollow(follow.mangaId, service.serviceId)}>
                    {followedServices.indexOf(service.serviceId) < 0 ? 'Follow' : 'Unfollow'}
                  </Button>
                </ListItem>
              ))}
            </List>
          </FollowDetails>
        </FollowContent>
      </Grid>
    );
  };

  return (

    <Container maxWidth='lg' disableGutters>
      <Paper sx={{ flexGrow: 1, p: 2 }}>
        <Grid container spacing={1}>
          {follows.map(renderFollow)}
        </Grid>
      </Paper>
    </Container>
  );
}

export default Follows;
