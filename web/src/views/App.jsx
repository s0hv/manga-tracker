import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles(() => ({
  root: {
    textAlign: 'center',
    height: '50vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

function App() {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <Typography variant='h1'>
        Home page
      </Typography>
    </div>
  );
}

function MainApp({ user }) {
  return (
    <App user={user} />
  );
}

export default MainApp;
