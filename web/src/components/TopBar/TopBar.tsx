import React, { useCallback } from 'react';
import MoonIcon from '@mui/icons-material/Brightness3';
import HomeIcon from '@mui/icons-material/Home';
import SunIcon from '@mui/icons-material/WbSunny';
import { AppBar, Button, IconButton, Toolbar, Typography } from '@mui/material';
import { styled, useColorScheme } from '@mui/material/styles';
import NextLink from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

import { useUser } from '@/webUtils/useUser';
import { Theme } from '@/types/dbTypes';
import { LinkComponent } from './LinkComponent';

const MangaSearch = dynamic(() => import('../MangaSearch'));
const UserMenu = dynamic(() => import('./UserMenu').then(mod => mod.UserMenu));


const PREFIX = 'TopBar';
const classes = {
  grow: `${PREFIX}-grow`,
  titleIcon: `${PREFIX}-titleIcon`,
};


const Root = styled('div')(({ theme }) => ({
  flexGrow: 1,
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
}));


function TopBar() {
  const { mode, setMode, systemMode } = useColorScheme();
  const { user } = useUser();
  const router = useRouter();

  const onAuthChange = useCallback(() => {
    console.log(router.asPath);
    window.sessionStorage.setItem('previousPage', router.asPath);
  }, [router.asPath]);

  const handleThemeChange = useCallback((): Theme => {
    const currentMode = mode === 'system' ? systemMode : mode;
    const val = currentMode === 'light' ? 'dark' : 'light';
    setMode(val);
    return val;
  }, [mode, setMode, systemMode]);

  return (
    <Root>
      <AppBar position='sticky'>
        <Toolbar>
          <NextLink href='/' prefetch={false} style={{ textDecoration: 'none', color: 'inherit' }}>
            <SiteTitle variant='h6' noWrap>
              Manga tracker
            </SiteTitle>
          </NextLink>
          <LinkComponent
            Component={IconButton}
            href='/'
            prefetch={false}
            className={classes.titleIcon}
            aria-label='return to home page'
            aria-controls='menu-appbar'
            color='inherit'
          >
            <HomeIcon />
          </LinkComponent>
          <div className={classes.grow} />
          <MangaSearch
            id='title-search'
            placeholder='Search manga'
          />
          {(user && (
            <UserMenu handleThemeChange={handleThemeChange} />
          )
          ) || (
          <React.Fragment>
            <NextLink href='/login' prefetch={false}>
              <Button variant='outlined' sx={{ position: 'relative', ml: 3, mr: 1, float: 'right' }} onClick={onAuthChange}>
                Login
              </Button>
            </NextLink>
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
