/* eslint-disable react/destructuring-assignment */
import { SnackbarProvider } from 'notistack';
import React, { useCallback, useEffect } from 'react';
import { MuiPickersUtilsProvider } from '@material-ui/pickers';
import {
  createMuiTheme,
  responsiveFontSizes,
  ThemeProvider,
} from '@material-ui/core/styles';
import { blue } from '@material-ui/core/colors';
import { CssBaseline, useMediaQuery } from '@material-ui/core';
import DateFnsUtils from '@date-io/date-fns';
import enLocale from 'date-fns/locale/en-GB';

import Head from 'next/head';
import Root from '../components/Root';
import { UserProvider } from '../utils/useUser';
import { ProgressBar } from '../components/utils/ProgressBar';


const sessionDebug = require('debug')('session-debug');


function MainApp({ Component, pageProps, props }) {
  const [theme, setTheme] = React.useState(props.theme);
  const [user, setUser] = React.useState(props.user);
  useEffect(() => setUser(props.user), [props.user]);

  const childSetTheme = useCallback((val) => setTheme(val), []);

  React.useEffect(() => {
    const jssStyles = document.querySelector('#jss-server-side');
    if (jssStyles) {
      jssStyles.parentElement.removeChild(jssStyles);
    }
    // doUpdate(!update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tempDark = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersDarkMode = theme === 0 ? tempDark : theme === 2;
  props.activeTheme = prefersDarkMode ? 2 : 1;
  props.user = user;
  props.setTheme = childSetTheme;

  const activeTheme = React.useMemo(
    () => responsiveFontSizes(createMuiTheme({
      palette: {
        type: prefersDarkMode ? 'dark' : 'light',
        primary: blue,
        background: {
          default: prefersDarkMode ? '#282c34' : '#FFFFFF',
        },
      },
    })),
    [prefersDarkMode]
  );

  return (
    <React.Fragment>
      <Head>
        <title>Manga tracker</title>
        <meta name='viewport' content='minimum-scale=1, initial-scale=1, width=device-width' />
      </Head>
      <ThemeProvider theme={activeTheme}>
        <CssBaseline />
        <ProgressBar />
        <MuiPickersUtilsProvider utils={DateFnsUtils} locale={enLocale}>
          <SnackbarProvider>
            <UserProvider value={user}>
              <Root {...props}>
                <main>
                  <Component {...pageProps} />
                </main>
              </Root>
            </UserProvider>
          </SnackbarProvider>
        </MuiPickersUtilsProvider>
      </ThemeProvider>
    </React.Fragment>
  );
}

MainApp.getInitialProps = async function getInitialProps({ ctx }) {
  if (!ctx.req) {
    return { props: { statusCode: 200 }};
  }
  sessionDebug('Initial props', ctx.req.user);
  const req = ctx.req;
  return {
    props: {
      user: req.user,
      theme: req.user?.theme || req.session?.theme || 0,
      statusCode: ctx.res?.statusCode || 200,
    },
  };
};

export default MainApp;
