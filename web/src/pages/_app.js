/* eslint-disable react/destructuring-assignment */
import { SnackbarProvider } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { MuiPickersUtilsProvider } from '@material-ui/pickers';
import {
  createMuiTheme,
  responsiveFontSizes,
  ThemeProvider,
} from '@material-ui/core/styles';
import { blue } from '@material-ui/core/colors';
import { CssBaseline } from '@material-ui/core';
import DateFnsUtils from '@date-io/date-fns';
import enLocale from 'date-fns/locale/en-GB';

import Head from 'next/head';
import { DefaultSeo } from 'next-seo';

import Root from '../components/Root';
import { UserProvider } from '../utils/useUser';
import { csrfProps, CSRFProvider } from '../utils/csrf';

import { ProgressBar } from '../components/utils/ProgressBar';


const sessionDebug = require('debug')('session-debug');


function MainApp({ Component, pageProps, props }) {
  const [theme, setTheme] = React.useState(props.theme);
  const [user, setUser] = React.useState(props.user);
  const [prefersDark, setPrefersDark] = useState(theme === 2);

  useEffect(() => setUser(props.user), [props.user]);

  const childSetTheme = useCallback((val) => {
    setTheme(val);
    if (!user) {
      window.localStorage.setItem('darkTheme', val.toString());
    }
  }, [user]);

  useEffect(() => {
    const jssStyles = document.querySelector('#jss-server-side');
    if (jssStyles) {
      jssStyles.parentElement.removeChild(jssStyles);
    }
  }, []);

  useEffect(() => {
    setPrefersDark(theme === 2);
    if (!user) {
      const darkTheme = window.localStorage.getItem('darkTheme');
      if (!darkTheme) return;

      setPrefersDark(darkTheme === '2');
    }
  }, [user, theme]);

  // Does not work without workarounds
  // const tempDark = useMediaQuery('(prefers-color-scheme: dark)');
  // const prefersDarkMode = theme === 0 ? tempDark : theme === 2;

  props.activeTheme = prefersDark ? 2 : 1;
  props.user = user;
  props.setTheme = childSetTheme;

  const activeTheme = React.useMemo(
    () => responsiveFontSizes(createMuiTheme({
      palette: {
        type: prefersDark ? 'dark' : 'light',
        primary: blue,
        background: {
          default: prefersDark ? '#282c34' : '#FFFFFF',
        },
      },
    })),
    [prefersDark]
  );

  return (
    <React.Fragment>
      <Head>
        <meta name='viewport' content='minimum-scale=1, initial-scale=1, width=device-width' />
      </Head>
      <DefaultSeo
        titleTemplate='%s - Manga tracker'
        defaultTitle='Manga tracker'
        openGraph={{
          title: 'Manga tracker',
          site_name: 'Manga tracker',
          type: 'website',
          locale: 'en_IE',
        }}
      />

      <ThemeProvider theme={activeTheme}>
        <CssBaseline />
        <ProgressBar />
        <MuiPickersUtilsProvider utils={DateFnsUtils} locale={enLocale}>
          <SnackbarProvider>
            <UserProvider value={user}>
              <CSRFProvider value={props._csrf}>
                <Root {...props}>
                  <main>
                    <Component {...pageProps} />
                  </main>
                </Root>
              </CSRFProvider>
            </UserProvider>
          </SnackbarProvider>
        </MuiPickersUtilsProvider>
      </ThemeProvider>
    </React.Fragment>
  );
}

MainApp.getInitialProps = async function getInitialProps({ ctx: { req, res }}) {
  if (!req) {
    return { props: { statusCode: 200 }};
  }
  sessionDebug('Initial props', req.user);

  return {
    props: {
      user: req.user,
      theme: req.user?.theme || req.session?.theme || 0,
      statusCode: res?.statusCode || 200,
      ...csrfProps({ req }).props,
    },
  };
};

export default MainApp;
