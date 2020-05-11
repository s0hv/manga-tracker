import React from 'react';
import ExpandMore from '@material-ui/icons/ExpandMore';
import ExpandLess from '@material-ui/icons/ExpandLess';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Collapse from '@material-ui/core/Collapse';
import {makeStyles} from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';


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
    color: theme.palette.primary.contrastText
  }
}));

export default function (props) {
  const {
    items = [],
    followUnfollow = () => {},
    userFollows = [],
    isAuthenticated = false,
    classesProp = [],
  } = props;

  const classes = useStyles();
  const [open, setOpen] = React.useState(false);
  const handleClick = () => {
    setOpen(!open);
  };

  function renderItem(item, index) {
    return (
      <ListItem className={classes.nested} key={index}>
        <Typography>{item.name}</Typography>
        {isAuthenticated &&
          <Button variant='contained' color='primary' onClick={followUnfollow(item.service_id)}>
            {userFollows.indexOf(item.service_id) < 0 ? 'Follow' : 'Unfollow'}
          </Button>}
      </ListItem>
    )
  }

  return (
    <List
      component="nav"
      aria-labelledby="nested-list-subheader"
      className={`${classes.root} ${classesProp.join(' ')}`}
    >
      <ListItem button onClick={handleClick} className={classes.mainItem}>
        <ListItemText primary="Manga sources" className={classes.listOpener}/>
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItem>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {items.map((item, index) => {
            return renderItem(item, index);
          })}
        </List>
      </Collapse>
    </List>
  );
}