import React from 'react';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import {
  Button,
  Collapse,
  Link,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import PropTypes from 'prop-types';
import { useUser } from '../utils/useUser';


const ListItemStyled = styled(ListItem)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.vars.palette.primary.main,
  '&:hover': {
    backgroundColor: theme.vars.palette.primary.dark,
  },
}));

function MangaSourceList(props) {
  const {
    items = [],
    followUnfollow = (_) => undefined,
    userFollows = [],
    classesProp = [],
    openByDefault = false,
  } = props;

  const { isAuthenticated } = useUser();
  const [open, setOpen] = React.useState(openByDefault);
  const handleClick = () => {
    setOpen(!open);
  };

  function renderItem(item) {
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
      <ListItemStyled
        button
        onClick={handleClick}
        aria-label={`${open ? 'close' : 'open'} follows`}
      >
        <ListItemText primary='Manga sources' sx={{ color: 'primary.contrastText' }} />
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItemStyled>
      <Collapse in={open} timeout='auto' unmountOnExit>
        <List component='div' disablePadding aria-hidden={!open}>
          {items.map((item, index) => renderItem(item, index))}
        </List>
      </Collapse>
    </List>
  );
}

MangaSourceList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object),
  followUnfollow: PropTypes.func,
  userFollows: PropTypes.arrayOf(PropTypes.number),
  classesProp: PropTypes.arrayOf(PropTypes.string),
  openByDefault: PropTypes.bool,
};

export default MangaSourceList;
