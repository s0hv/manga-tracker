import React, { MouseEventHandler } from 'react';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import {
  Button,
  Collapse,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';

import type { MangaServiceData } from '@/types/api/manga';

import { useIsUserAuthenticated } from '../store/userStore';


export type MangaSourceListProps = {
  items?: MangaServiceData[]
  followUnfollow?: (serviceId: number | null) => (undefined | MouseEventHandler<HTMLButtonElement>)
  userFollows?: (number | null)[]
  classesProp?: string[]
  openByDefault?: boolean
};

function MangaSourceList(props: MangaSourceListProps) {
  const {
    items = [],
    followUnfollow = _ => undefined,
    userFollows = [],
    classesProp = [],
    openByDefault = false,
  } = props;

  const isAuthenticated = useIsUserAuthenticated();

  const [open, setOpen] = React.useState(openByDefault);
  const handleClick = () => {
    setOpen(!open);
  };

  function renderItem(item: MangaServiceData) {
    const followText = userFollows.indexOf(item.serviceId) < 0 ? 'Follow' : 'Unfollow';
    return (
      <ListItem key={item.serviceId} sx={{ pl: 4, display: 'flex', justifyContent: 'space-between' }}>
        <Typography>
          <Link
            href={item.url.replace('{}', item.titleId)}
            target='_blank'
            rel='noopener noreferrer'
            underline='hover'
          >
            {item.name}
          </Link>
        </Typography>
        {isAuthenticated && (
          <Button
            variant='contained'
            color='primary'
            onClick={followUnfollow(item.serviceId)}
            aria-label={`${followText.toLowerCase()} ${item.name}`}
          >
            {followText}
          </Button>
        )}
      </ListItem>
    );
  }

  return (
    <List
      aria-label='manga sources'
      sx={{ width: '100%', maxWidth: '360px' }}
      className={`${classesProp.join(' ')}`}
    >
      <ListItemButton
        onClick={handleClick}
        aria-label={`${open ? 'close' : 'open'} follows`}
        sx={{
          borderRadius: 1,
          backgroundColor: 'primary.main',
          '&:hover': {
            backgroundColor: 'primary.dark',
          },
        }}
      >
        <ListItemText primary='Manga sources' sx={{ color: 'primary.contrastText' }} />
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>
      <Collapse in={open} timeout='auto' unmountOnExit>
        <List component='div' disablePadding aria-hidden={!open}>
          {items.map(item => renderItem(item))}
        </List>
      </Collapse>
    </List>
  );
}

export default MangaSourceList;
