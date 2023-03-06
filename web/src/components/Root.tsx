import React, { type PropsWithChildren, useEffect, useState } from 'react';
import {
  Divider,
  IconButton,
  Link,
  Typography,
  type TypographyProps,
} from '@mui/material';
import { styled, useColorScheme } from '@mui/material/styles';
import GitHubIcon from '@mui/icons-material/GitHub';
import NextLink from 'next/link';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import TopBar from './TopBar';
import type { FrontendUser } from '@/webUtils/useUser';


const Root = styled('div')({
  width: '100%',
  overflow: 'auto',
  minWidth: '400px',
  minHeight: '100vh',
  position: 'relative',
});

const FooterContainer = styled('div')(({ theme }) => ({
  paddingTop: theme.spacing(10),
  position: 'static',
  left: 0,
  overflow: 'auto',
}));

const FooterStyled = styled('footer')({
  bottom: '0px',
  position: 'absolute',
  width: '100%',
});

const FooterContent = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginLeft: theme.spacing(3),
  marginRight: theme.spacing(3),
}));

function Copyright(props: TypographyProps) {
  return (
    <Typography {...props}>
      {'Copyright © '}
      <Link color='inherit' href='https://github.com/s0hv'>
        s0hv
      </Link>
      {' '}
      {new Date().getFullYear()}
      .
    </Typography>
  );
}

export type RootProps = {
  statusCode?: number,
  user?: FrontendUser
}
export default function Layout(props: PropsWithChildren<RootProps>): ReturnType<React.FC<any>> {
  const {
    statusCode,
    user,
    children,
  } = props;

  const { setMode } = useColorScheme();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  }));

  // Change theme when logging in/out.
  // Will not be instant as the useEffect takes a bit to run.
  // Should not be the biggest problem since the default theme is system theme.
  useEffect(() => {
    setMode(user?.theme || 'system');
  }, [user, setMode]);

  if (statusCode !== 200) {
    // Typescript doesn't like it without them
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Root>
        <TopBar />
        {children}
        <FooterContainer>
          <FooterStyled>
            <Divider variant='middle' />
            <FooterContent>
              <Copyright />
              <div>
                <NextLink href='/third_party_notices' style={{ marginRight: '8px', color: 'inherit' }}>
                  Third party notices
                </NextLink>
                <NextLink href='/privacy_policy' style={{ marginRight: '8px', color: 'inherit' }}>
                  Privacy Policy
                </NextLink>
                <NextLink href='/terms' style={{ marginRight: '8px', color: 'inherit' }}>
                  Terms
                </NextLink>
                <Link color='inherit' href='https://github.com/s0hv/manga-tracker/blob/master/LICENSE' aria-label='license'>
                  License
                </Link>
                <IconButton
                  component='a'
                  href='https://github.com/s0hv/manga-tracker'
                  aria-label='github repository'
                  size='large'
                >
                  <GitHubIcon />
                </IconButton>
              </div>
            </FooterContent>
          </FooterStyled>
        </FooterContainer>
      </Root>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
