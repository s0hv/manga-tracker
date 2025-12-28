import React, { type PropsWithChildren, FC, useEffect } from 'react';
import GitHubIcon from '@mui/icons-material/GitHub';
import {
  type SxProps,
  type TypographyProps,
  Box,
  Divider,
  IconButton,
  Link as MuiLink,
  Typography,
} from '@mui/material';
import { styled, useColorScheme } from '@mui/material/styles';

import { type FrontendUser, useUser } from '../store/userStore';

import { RouteLink } from './common/RouteLink';
import TopBar from './TopBar';

const footerLinkSx = { mr: 1, color: 'inherit' } as const satisfies SxProps;

const Root = styled('div')({
  width: '100%',
  overflow: 'auto',
  minWidth: '300px',
  minHeight: '100vh',
  position: 'relative',
  display: 'flex',
  flexFlow: 'column',
  alignItems: 'anchor-center',
  justifyContent: 'flex-start',

  '& > main': {
    display: 'flex',
    width: '100%',
    flex: 5,
  },
});

const FooterStyled = styled('footer')({
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
      <MuiLink color='inherit' href='https://github.com/s0hv'>
        s0hv
      </MuiLink>
      {' '}
      {new Date().getFullYear()}
      .
    </Typography>
  );
}

export type RootProps = {
  statusCode?: number
  user?: FrontendUser | null
};
export const Layout: FC<PropsWithChildren<RootProps>> = props => {
  const {
    children,
  } = props;

  const user = useUser();

  const { setMode } = useColorScheme();

  // Change theme when logging in/out.
  // Will not be instant as the useEffect takes a bit to run.
  // Should not be the biggest problem since the default theme is system theme.
  useEffect(() => {
    setMode(user?.theme || 'system');
    // setMode changes when theme is changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <Root>
      <TopBar />
      {children}
      <Box sx={{ flex: 1, minHeight: '2rem' }} />
      <FooterStyled>
        <Divider variant='middle' />
        <FooterContent>
          <Copyright />
          <div>
            <RouteLink to='/third_party_notices' sx={footerLinkSx}>
              Third party notices
            </RouteLink>
            <RouteLink to='/privacy_policy' sx={footerLinkSx}>
              Privacy Policy
            </RouteLink>
            <RouteLink to='/terms' sx={footerLinkSx}>
              Terms
            </RouteLink>
            <MuiLink color='inherit' href='https://github.com/s0hv/manga-tracker/blob/master/LICENSE' aria-label='license'>
              License
            </MuiLink>
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
    </Root>
  );
};
