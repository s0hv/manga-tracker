import { CssBaseline } from '@mui/material';
import {
  StyledEngineProvider,
  Experimental_CssVarsProvider as CssVarsProvider,
} from '@mui/material/styles';
import { DefaultSeo } from 'next-seo';
import { CacheProvider } from '@emotion/react';
import NextNProgress from 'nextjs-progressbar';

import Head from 'next/head';
import { SnackbarProvider } from 'notistack';
import React, { useEffect } from 'react';

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
            <CssVarsProvider theme={theme} defaultMode='system'>
              <NextNProgress />
              <CssBaseline />
              {pageProps.staticPage ? (
                <main>
                  <Component {...pageProps} />
                </main>
              ) : (
                <SnackbarProvider>
                  <UserProvider value={user}>
                    <CSRFProvider value={csrf}>
                      <Root {...props}>
                        <main>
                          <Component {...pageProps} />
                        </main>
                      </Root>
                    </CSRFProvider>
                  </UserProvider>
                </SnackbarProvider>
              )}
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

  return {
    props: {
      user: getUserData(req.user),
      statusCode: res?.statusCode || 200,
      ...csrfProps({ req }).props,
    },
  };
};

export default MainApp;
