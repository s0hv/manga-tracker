import { CssBaseline } from '@mui/material';
import {
  StyledEngineProvider,
  Experimental_CssVarsProvider as CssVarsProvider,
} from '@mui/material/styles';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import enLocale from 'date-fns/locale/en-GB';
import { DefaultSeo } from 'next-seo';
import { CacheProvider } from '@emotion/react';
import NextNProgress from 'nextjs-progressbar';
// Hydrate not used as relative fetch methods can't be used server-side
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import Head from 'next/head';
import { SnackbarProvider } from 'notistack';
import React, { useEffect, useState } from 'react';
import { sessionLogger } from '../../utils/logging';

import Root from '../components/Root';

import { csrfProps, CSRFProvider } from '../utils/csrf';
import { UserProvider } from '../utils/useUser';
import { theme } from '../utils/theme';
import createEmotionCache from '../utils/createEmotionCache';


// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();


function MainApp({ Component, pageProps = {}, emotionCache = clientSideEmotionCache, props }) {
  const [user, setUser] = React.useState(props.user);
  const [csrf, setCsrf] = React.useState(props._csrf);
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  }));

  useEffect(() => setUser(props.user), [props.user]);
  useEffect(() => setCsrf(props._csrf), [props._csrf]);

  props.user = user;

  return (
    <>
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
            <CssVarsProvider theme={theme}>
              <NextNProgress />
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
            </CssVarsProvider>
          </StyledEngineProvider>
        </CacheProvider>
      )}
    </>
  );
}

const getUserData = (user) => (user ? ({
  uuid: user.uuid,
  username: user.username,
  theme: user.theme,
  admin: user.admin,
  isCredentialsAccount: user.isCredentialsAccount,
}) : null);

MainApp.getInitialProps = async function getInitialProps({ ctx: { req, res }}) {
  if (!req) {
    return { props: { statusCode: 200 }};
  }
  sessionLogger.debug('Initial props %o', req.user);
  sessionLogger.debug(csrfProps({ req }));

  return {
    props: {
      user: getUserData(req.user),
      statusCode: res?.statusCode || 200,
      ...csrfProps({ req }).props,
    },
  };
};

export default MainApp;
