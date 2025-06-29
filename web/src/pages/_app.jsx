import React, { useEffect } from 'react';

import { CssBaseline } from '@mui/material';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import { AppCacheProvider } from '@mui/material-nextjs/v15-pagesRouter';
import { CacheProvider } from '@emotion/react';
import Head from 'next/head';
import { DefaultSeo } from 'next-seo';
import NextNProgress from 'nextjs-progressbar';
import { SnackbarProvider } from 'notistack';

import { Layout } from '../components/Layout';
import createEmotionCache from '../utils/createEmotionCache';
import { theme } from '../utils/theme';
import { UserProvider } from '../utils/useUser';


// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();


function MainApp(allProps) {
  const { Component, pageProps = {}, emotionCache = clientSideEmotionCache, props } = allProps;

  const [user, setUser] = React.useState(props.user);

  useEffect(() => setUser(props.user), [props.user]);
  // Clear previous page on page load/refresh
  useEffect(() => window.sessionStorage.removeItem('previousPage'), []);

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

      { pageProps.independent
        ? (
          <main>
            <Component {...pageProps} />
          </main>
        )
        : (
          <AppCacheProvider {...allProps}>
            <CacheProvider value={emotionCache}>
              <StyledEngineProvider injectFirst>
                <ThemeProvider theme={theme} defaultMode='system'>
                  <NextNProgress />
                  <CssBaseline />
                  {pageProps.staticPage
                    ? (
                      <main>
                        <Component {...pageProps} />
                      </main>
                    )
                    : (
                      <SnackbarProvider>
                        <UserProvider value={user}>
                          <Layout {...props}>
                            <main>
                              <Component {...pageProps} />
                            </main>
                          </Layout>
                        </UserProvider>
                      </SnackbarProvider>
                    )}
                </ThemeProvider>
              </StyledEngineProvider>
            </CacheProvider>
          </AppCacheProvider>
        )}
    </>
  );
}

const getUserData = user => (user
  ? ({
    uuid: user.uuid,
    username: user.username,
    theme: user.theme,
    admin: user.admin,
    isCredentialsAccount: user.isCredentialsAccount,
  })
  : null);

MainApp.getInitialProps = async function getInitialProps({ ctx: { req, res }}) {
  if (!req) {
    return { props: { statusCode: 200 }};
  }

  return {
    props: {
      user: getUserData(req.user),
      statusCode: res?.statusCode || 200,
    },
  };
};

export default MainApp;
