import { ComponentType, useEffect, useState } from 'react';
import { CssBaseline } from '@mui/material';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import { AppCacheProvider } from '@mui/material-nextjs/v15-pagesRouter';
import Head from 'next/head';
import { GetServerSidePropsResult } from 'next/types';
import { DefaultSeo } from 'next-seo';
import NextNProgress from 'nextjs-progressbar';
import { SnackbarProvider } from 'notistack';

import { Layout } from '@/components/Layout';
import type { SessionUser } from '@/types/dbTypes';
import type {
  GetServerSidePropsContextExpress,
  PageProps,
} from '@/types/nextjs';
import { theme } from '@/webUtils/theme';
import { type FrontendUser, UserProvider } from '@/webUtils/useUser';

type DefaultProps = {
  statusCode: number
  user?: FrontendUser | null
};


type MainAppProps<TProps extends PageProps> = {
  Component: ComponentType<TProps>
  pageProps?: TProps
  props: DefaultProps
};
function MainApp<TProps extends PageProps>(allProps: MainAppProps<TProps>) {
  const { Component, pageProps, props } = allProps;

  const [user, setUser] = useState(props.user);

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

      { pageProps?.independent
        ? (
          <main>
            <Component {...pageProps} />
          </main>
        )
        : (
          <AppCacheProvider {...allProps}>
            <StyledEngineProvider injectFirst>
              <ThemeProvider theme={theme} defaultMode='system'>
                <NextNProgress />
                <CssBaseline />
                {pageProps?.staticPage
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
                            <Component {...pageProps!} />
                          </main>
                        </Layout>
                      </UserProvider>
                    </SnackbarProvider>
                  )}
              </ThemeProvider>
            </StyledEngineProvider>
          </AppCacheProvider>
        )}
    </>
  );
}

const getUserData = (user: SessionUser | null): FrontendUser | null => (user
  ? ({
    uuid: user.uuid,
    username: user.username,
    theme: user.theme,
    admin: user.admin,
    isCredentialsAccount: user.isCredentialsAccount,
  })
  : null);

MainApp.getInitialProps = async function getInitialProps(
  { ctx: { req, res }}: { ctx: GetServerSidePropsContextExpress }
): Promise<GetServerSidePropsResult<DefaultProps>> {
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
