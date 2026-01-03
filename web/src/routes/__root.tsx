/// <reference types="vite/client" />
import React, { type PropsWithChildren } from 'react';
import { CssBaseline } from '@mui/material';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { ThemeProvider } from '@mui/material/styles';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import fontsourceVariableRobotoCss from '@fontsource-variable/roboto?url';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { SnackbarProvider } from 'notistack';

import { Layout } from '@/components/Layout';
import type { SessionUser } from '@/types/dbTypes';
import type { RouterContext } from '@/types/tanstack-start';
import { getCspNonce } from '@/webUtils/routeUtils';

import { type FrontendUser, UserStoreProvider } from '../store/userStore';
import { theme } from '../utils/theme';

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    links: [{ rel: 'stylesheet', href: fontsourceVariableRobotoCss }],
  }),
  component: RootComponent,
  beforeLoad: async ({ serverContext }) => {
    if (!serverContext) {
      return {
        frontendUser: null,
      };
    }

    return {
      frontendUser: getFrontendUserFromSessionUser(serverContext.user),
    };
  },
  loader: () => {
    return getCspNonce();
  },
});

function getFrontendUserFromSessionUser(user: SessionUser | null): FrontendUser | null {
  if (!user) return null;

  return {
    username: user.username,
    uuid: user.userUuid,
    theme: user.theme,
    admin: user.admin,
  };
}

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

const Providers = ({ children }: PropsWithChildren) => {
  const emotionCache = createCache({ key: 'mui-emotion' });

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
};

const RootDocument = ({ children }: PropsWithChildren) => {
  const isStaticPage = useRouterState({
    // This is important. Without, the whole page rerenders on navigations slowing everything down
    select: state => state.matches.some(s => s.context.isStaticPage),
    structuralSharing: true,
  });

  const frontendUser = Route.useRouteContext({
    select: ctx => ctx.frontendUser,
  });

  const nonce = Route.useLoaderData();

  // noinspection HtmlRequiredTitleElement
  return (
    <html
      lang='en'
      // Suppress hydration warnings as the color scheme class is injected here
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
        {/* PWA primary color */}
        <meta name='theme-color' content={theme.colorSchemes.dark?.palette.primary.main} />
        <meta name='emotion-insertion-point' content='' />
        <meta name='viewport' content='initial-scale=1, width=device-width' />
        <link rel='icon' type='image/png' href='/favicon-96x96.png' sizes='96x96' />
        <link rel='icon' type='image/svg+xml' href='/favicon.svg' />
        <link rel='shortcut icon' href='/favicon.ico' />
        <link rel='apple-touch-icon' sizes='180x180' href='/apple-touch-icon.png' />
        <meta name='apple-mobile-web-app-title' content='Manga tracker' />
        <link rel='manifest' href='/site.webmanifest' />
      </head>
      <body>
        <InitColorSchemeScript defaultMode='system' attribute='class' nonce={nonce} />
        <Providers>
          {/* User store provider should be before the static page check
              to prevent user info from disappearing when visiting a static page */}
          <UserStoreProvider user={frontendUser}>
            {isStaticPage
              ? (
                <main>
                  {children}
                </main>
              )
              : (
                <SnackbarProvider>
                  <Layout>
                    <main>
                      {children}
                    </main>
                  </Layout>
                </SnackbarProvider>
              )}
          </UserStoreProvider>
        </Providers>

        <TanStackRouterDevtools position='bottom-right' />
        <ReactQueryDevtools initialIsOpen={false} buttonPosition='bottom-left' />
        <Scripts />
      </body>
    </html>
  );
};

