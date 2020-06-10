import React from 'react';
import {makeStyles, Paper, Typography,} from '@material-ui/core'

const useStyles = makeStyles((theme) => ({
  paper: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.palette.background.paper,
    minHeight: '100vh',
    verticalAlign: 'center',
  },
  text: {
    textAlign: 'center',
    color: theme.palette.text.primary,
    alignItems: 'center'
  },
}));

export default function NotFound() {
  const classes = useStyles();

  return (
      <Paper className={classes.paper} square={true}>
        <Typography className={classes.text} component="h1" variant="h1">
          404 Not found
        </Typography>
      </Paper>
  );
}