/* eslint-disable */
import React from 'react';
import { Divider, Link, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
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
  divider: {
    marginTop: theme.spacing(5),
    marginBottom: theme.spacing(2),
  },
  footer: {
    bottom: theme.spacing(2),
    position: 'absolute',
    width: '100%',
    marginTop: theme.spacing(10),
  },
  copyright: {
    marginLeft: theme.spacing(3),
    bottom: theme.spacing(2),
  },
}));

function Copyright(props) {
  return (
    <Typography {...props}>
      { 'Copyright © '}
      <Link color='inherit' href='https://github.com/s0hv'>
        s0hv
      </Link>
      { ' ' }
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
    children
  } = props;
  const classes = useStyles();

  if (statusCode !== 200) {
    return children
  }

  return (
    <div className={classes.root}>
      <TopBar setTheme={setTheme} activeTheme={activeTheme} />
      {children}
      <div className={classes.container}>
        <footer className={classes.footer}>
          <Divider className={classes.divider} variant='middle' />
          <Copyright className={classes.copyright} />
        </footer>
      </div>
    </div>
  );
}

Layout.propTypes = {
  Component: PropTypes.elementType,
  // eslint-disable-next-line react/forbid-prop-types
  pageProps: PropTypes.object,
  props: PropTypes.shape({
    statusCode: PropTypes.number,
    activeTheme: PropTypes.number,
    user: PropTypes.object,
    setTheme: PropTypes.func,
  }),
};
