import TopBar from '../components/TopBar'
import React from "react";
import {makeStyles} from "@material-ui/styles";


const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
    overflow: 'auto',
    minWidth: '400px'
  },
}));

export default function ({ Component, pageProps, props }) {
    const classes = useStyles();

    return (
      <div className={classes.root}>
        <TopBar user={props.user}/>
        <Component {...pageProps} isAuthenticated={Boolean(props.user)} />
      </div>
    )
}