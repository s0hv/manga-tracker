import React from 'react';
import { styled } from '@mui/material/styles';
import {
  Button,
  Container,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import Image from 'next/image';
import NextLink from 'next/link';
import { useCSRF } from '../utils/csrf';

import { defaultDateDistanceToNow, followUnfollow } from '../utils/utilities';
import { nextImageFix } from '../utils/theme';


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
  maxWidth: '256px',
  [theme.breakpoints.down('sm')]: {
    maxWidth: '192px',
  },
  ...nextImageFix,
}));

const serviceNameText = { mr: 2 };
const followServiceItem = { display: 'flex', justifyContent: 'space-between' };

function Follows(props) {
  const {
    follows = [],
  } = props;

  const csrf = useCSRF();
  const columnsXs = 1;
  const columnsMd = 2;

  const renderFollow = (follow) => {
    const followedServices = follow.followedServices;

    return (
      <Grid item xs={12/columnsXs} md={12/columnsMd} key={follow.mangaId}>
        <Typography
          sx={{ pt: 2, pl: 2 }}
          variant='h4'
          align='center'
        >
          {follow.title}
        </Typography>
        <FollowContent>
          <Thumbnail>
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
                      {defaultDateDistanceToNow(new Date(follow.latestRelease))}
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
                <Button variant='contained' color='primary' onClick={followUnfollow(csrf, follow.mangaId)}>
                  {followedServices.indexOf(null) < 0 ? 'Follow' : 'Unfollow'}
                </Button>
              </ListItem>
              {follow.services.map((service) => (
                <ListItem key={service.serviceId} sx={followServiceItem} disableGutters>
                  <ListItemText primary={service.serviceName} sx={serviceNameText} />
                  <Button variant='contained' color='primary' onClick={followUnfollow(csrf, follow.mangaId, service.serviceId)}>
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
