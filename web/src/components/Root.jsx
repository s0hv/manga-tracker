import React from 'react';
import { Divider, Link, Typography, IconButton } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import GitHubIcon from '@material-ui/icons/GitHub';
import PropTypes from 'prop-types';

import TopBar from './TopBar';


const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
    overflow: 'auto',
    minWidth: '400px',
    minHeight: '100vh',
    position: 'relative',
  },
  container: {
    paddingTop: theme.spacing(10),
  },
  footer: {
    bottom: '0px',
    position: 'absolute',
    width: '100%',
  },
  footerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: theme.spacing(3),
    marginRight: theme.spacing(3),
  },
}));

function Copyright(props) {
  return (
    <Typography {...props}>
      {'Copyright © '}
      <Link color='inherit' href='https://github.com/s0hv'>
        s0hv
      </Link>
      {' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

export default function Layout(props) {
  const {
    statusCode,
    activeTheme,
    setTheme,
    children,
  } = props;
  const classes = useStyles();

  if (statusCode !== 200) {
    return children;
  }

  return (
    <div className={classes.root}>
      <TopBar setTheme={setTheme} activeTheme={activeTheme} />
      {children}
      <div className={classes.container}>
        <footer className={classes.footer}>
          <Divider variant='middle' />
          <div className={classes.footerContent}>
            <Copyright />
            <div>
              <Link color='inherit' href='https://github.com/s0hv/manga-tracker/blob/master/LICENSE' aria-label='license'>
                License
              </Link>
              <IconButton component='a' href='https://github.com/s0hv/manga-tracker' aria-label='github repository'>
                <GitHubIcon />
              </IconButton>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

Layout.propTypes = {
  props: PropTypes.shape({
    statusCode: PropTypes.number,
    activeTheme: PropTypes.number,
    user: PropTypes.object,
    setTheme: PropTypes.func,
    children: PropTypes.elementType,
  }),
};
