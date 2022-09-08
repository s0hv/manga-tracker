import { CssBaseline } from '@mui/material';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import enLocale from 'date-fns/locale/en-GB';
import { DefaultSeo } from 'next-seo';
import { CacheProvider } from '@emotion/react';
// Hydrate not used as relative fetch methods can't be used server-side
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import Head from 'next/head';
import { SnackbarProvider } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { sessionLogger } from '../../utils/logging';

import Root from '../components/Root';

import ProgressBar from '../components/utils/ProgressBar';
import { csrfProps, CSRFProvider } from '../utils/csrf';
import { UserProvider } from '../utils/useUser';
import { getTheme } from '../utils/theme';
import createEmotionCache from '../utils/createEmotionCache';


// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();


function MainApp({ Component, pageProps = {}, emotionCache = clientSideEmotionCache, props }) {
  const [theme, setTheme] = React.useState(props.theme);
  const [user, setUser] = React.useState(props.user);
  const [csrf, setCsrf] = React.useState(props._csrf);
  const [prefersDark, setPrefersDark] = useState(theme === 2);
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  }));

  useEffect(() => setUser(props.user), [props.user]);
  useEffect(() => setCsrf(props._csrf), [props._csrf]);

  const childSetTheme = useCallback((val) => {
    setTheme(val);
    if (!user) {
      window.localStorage.setItem('darkTheme', val.toString());
    }
  }, [user]);

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

  const activeTheme = React.useMemo(() => getTheme(prefersDark),
    [prefersDark]);

  return (
    <React.Fragment>
      <Head>
        <meta name='viewport' content='initial-scale=1, width=device-width' />
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

      { pageProps.independent ? (
        <main>
          <Component {...pageProps} />
        </main>
      ) : (
        <CacheProvider value={emotionCache}>
          <StyledEngineProvider injectFirst>
            <ThemeProvider theme={activeTheme}>
              <ProgressBar />
              <CssBaseline />
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enLocale}>
                <SnackbarProvider>
                  <QueryClientProvider client={queryClient}>
                    <UserProvider value={user}>
                      <CSRFProvider value={csrf}>
                        <Root {...props}>
                          <main>
                            <Component {...pageProps} />
                          </main>
                        </Root>
                        <ReactQueryDevtools initialIsOpen={false} />
                      </CSRFProvider>
                    </UserProvider>
                  </QueryClientProvider>
                </SnackbarProvider>
              </LocalizationProvider>
            </ThemeProvider>
          </StyledEngineProvider>
        </CacheProvider>
      )}
    </React.Fragment>
  );
}

MainApp.getInitialProps = async function getInitialProps({ ctx: { req, res }}) {
  if (!req) {
    return { props: { statusCode: 200 }};
  }
  sessionLogger.debug('Initial props %o', req.user);
  sessionLogger.debug(csrfProps({ req }));

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
