import React from 'react';
import ExpandMore from '@material-ui/icons/ExpandMore';
import ExpandLess from '@material-ui/icons/ExpandLess';
import {
  Button,
  Collapse,
  Link,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import { useUser } from '../utils/useUser';


const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.palette.background.paper,
  },
  mainItem: {
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  nested: {
    paddingLeft: theme.spacing(4),
    display: 'flex',
    justifyContent: 'space-between',
  },
  listOpener: {
    color: theme.palette.primary.contrastText,
  },
}));

function MangaSourceList(props) {
  const {
    items = [],
    followUnfollow = () => {},
    userFollows = [],
    classesProp = [],
  } = props;

  const { isAuthenticated } = useUser();
  const classes = useStyles();
  const [open, setOpen] = React.useState(false);
  const handleClick = () => {
    setOpen(!open);
  };

  function renderItem(item, index) {
    return (
      <ListItem className={classes.nested} key={index}>
        <Typography>
          <Link href={item.url.replace('{}', item.title_id)} target='_blank' rel='noopener noreferrer'>{item.name}</Link>
        </Typography>
        {isAuthenticated && (
          <Button variant='contained' color='primary' onClick={followUnfollow(item.service_id)}>
            {userFollows.indexOf(item.service_id) < 0 ? 'Follow' : 'Unfollow'}
          </Button>
        )}
      </ListItem>
    );
  }

  return (
    <List
      component='nav'
      aria-labelledby='nested-list-subheader'
      className={`${classes.root} ${classesProp.join(' ')}`}
    >
      <ListItem button onClick={handleClick} className={classes.mainItem}>
        <ListItemText primary='Manga sources' className={classes.listOpener} />
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItem>
      <Collapse in={open} timeout='auto' unmountOnExit>
        <List component='div' disablePadding>
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
};

export default MangaSourceList;
