import React, { useCallback } from 'react';
import MoonIcon from '@mui/icons-material/Brightness3';
import SunIcon from '@mui/icons-material/WbSunny';
import { AppBar, IconButton, Toolbar, Typography } from '@mui/material';
import { styled, useColorScheme } from '@mui/material/styles';
import { useRouter } from '@tanstack/react-router';

import { useUser } from '#web/store/userStore';
import { COOKIES } from '@/common/cookies';
import { LinkButton } from '@/components/common/LinkButton';
import { RouteLink } from '@/components/common/RouteLink';
import MangaSearch from '@/components/MangaSearch';
import { UserMenu } from '@/components/TopBar/UserMenu';
import { Theme } from '@/types/dbTypes';


const PREFIX = 'TopBar';
const classes = {
  grow: `${PREFIX}-grow`,
  titleIcon: `${PREFIX}-titleIcon`,
};


const Root = styled('div')(({ theme }) => ({
  position: 'sticky',
  overflow: 'auto',
  width: '100%',
  minWidth: '300px',
  left: 0,

  [`& .${classes.grow}`]: {
    flexGrow: 1,
  },

  [`& .${classes.titleIcon}`]: {
    flexGrow: 1,
    marginRight: theme.spacing(1),
    justifyContent: 'flex-start',

    [theme.breakpoints.up(500)]: {
      display: 'none',
    },
  },
}));


const SiteTitle = styled(Typography)(({ theme }) => ({
  flexGrow: 0,
  marginRight: theme.spacing(2),
  [theme.breakpoints.down(500)]: {
    display: 'none',
  },
  cursor: 'pointer',
  alignContent: 'center',
}));


function TopBar() {
  const { mode, setMode, systemMode } = useColorScheme();
  const user = useUser();
  const router = useRouter();

  const onLoginClick = useCallback(() => {
    document.cookie = `${COOKIES.redirect}=${encodeURIComponent(router.state.location.pathname)}; Path=/; SameSite=Lax;`;
  }, [router]);

  const handleThemeChange = useCallback((): Theme => {
    const currentMode = mode === 'system' ? systemMode : mode;
    const val = currentMode === 'light' ? 'dark' : 'light';
    setMode(val);
    return val;
  }, [mode, setMode, systemMode]);

  return (
    <Root>
      <AppBar position='sticky' sx={{ height: '64px' }}>
        <Toolbar sx={{
          pl: {
            xs: 1,
            '@500': 2,
          },
          pr: {
            xs: 1,
            '@500': 2,
          },
          gap: {
            xs: 1,
            '@500': 2,
          },
        }}
        >
          <RouteLink
            to='/'
            sx={{
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              height: '80%',
            }}
          >
            <img alt='Manga tracker logo' src='/favicon.svg' />
            <SiteTitle variant='h6' noWrap>
              Manga tracker
            </SiteTitle>
          </RouteLink>

          <div className={classes.grow} />

          <MangaSearch
            id='title-search'
            placeholder='Search manga'
          />

          {user
            ? <UserMenu handleThemeChange={handleThemeChange} />
            : (
              <React.Fragment>
                <LinkButton
                  to='/login'
                  preload='intent'
                  preloadDelay={500}
                  variant='outlined'
                  color='primary'
                  onClick={onLoginClick}
                  sx={{
                    position: 'relative',
                    ml: 3,
                    mr: 1,
                    float: 'right',
                  }}
                >
                  Login
                </LinkButton>

                <IconButton
                  aria-label='Switch theme'
                  onClick={handleThemeChange}
                  color='inherit'
                  size='large'
                >
                  {mode === 'light' ? <SunIcon /> : <MoonIcon />}
                </IconButton>
              </React.Fragment>
            )}
        </Toolbar>
      </AppBar>
    </Root>
  );
}

export default TopBar;
