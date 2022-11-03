import React from 'react';
import {
  AccountCircle,
  Bookmarks as BookmarksIcon,
  Brightness3 as MoonIcon,
  ExitToApp as ExitToAppIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  ViewList as ViewListIcon,
  WbSunny as SunIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import {
  AppBar,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import PropTypes from 'prop-types';
import NextLink from 'next/link';
import { useCSRF } from '../utils/csrf';

import MangaSearch from './MangaSearch';
import { useUser } from '../utils/useUser';
import { updateUserTheme, logoutUser } from '../api/user';

const PREFIX = 'TopBar';
const classes = {
  grow: `${PREFIX}-grow`,
  titleIcon: `${PREFIX}-titleIcon`,
  menuItemIcon: `${PREFIX}-menuItemIcon`,
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


const MenuStyled = styled(Menu)(({ theme }) => ({
  [`& .${classes.menuItemIcon}`]: {
    marginRight: theme.spacing(1),
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


const ProfileIconContainer = styled('div')(({ theme }) => ({
  position: 'relative',
  marginLeft: theme.spacing(2),
  float: 'right',
}));

const LinkComponent = ({ href, prefetch, as, Component, children, passHref=false, ...props }) => (
  <NextLink href={href} prefetch={prefetch} as={as} passHref={passHref} style={{ textDecoration: 'none', color: 'inherit' }}>
    <Component {...props}>
      {children}
    </Component>
  </NextLink>
);

function TopBar(props) {
  const {
    activeTheme,
    setTheme,
  } = props;

  const { user } = useUser();
  const csrf = useCSRF();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleThemeChange = () => {
    handleClose();
    const val = activeTheme === 1 ? 2 : 1;
    setTheme(val);
    updateUserTheme(csrf, val)
      .catch(console.error);
  };

  const handleLogout = () => {
    handleClose();
    logoutUser(csrf)
      .then(res => {
        window.location.replace(res.url);
      })
      .catch(err => {
        window.location.reload();
        console.error(err);
      });
  };

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
          <ProfileIconContainer>
            <IconButton
              aria-label='account of current user'
              aria-controls='menu-appbar'
              aria-haspopup='true'
              onClick={handleClick}
              color='inherit'
              size='large'
            >
              <AccountCircle fontSize='large' />
            </IconButton>
            <MenuStyled
              id='menu-appbar'
              disableScrollLock
              anchorEl={anchorEl}
              elevation={0}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={open}
              onClose={handleClose}
            >
              <LinkComponent Component={MenuItem} href='/profile' prefetch={false} onClick={handleClose}>
                <PersonIcon className={classes.menuItemIcon} /> Profile
              </LinkComponent>
              <MenuItem onClick={handleThemeChange}>
                { activeTheme === 2 ? <SunIcon className={classes.menuItemIcon} /> : <MoonIcon className={classes.menuItemIcon} />}
                Switch to {activeTheme === 2 ? 'light' : 'dark'} theme
              </MenuItem>
              <LinkComponent Component={MenuItem} href='/follows' prefetch={false} onClick={handleClose}>
                <BookmarksIcon className={classes.menuItemIcon} /> Follows
              </LinkComponent>
              <LinkComponent Component={MenuItem} href='/notifications' prefetch={false} onClick={handleClose}>
                <NotificationsIcon className={classes.menuItemIcon} /> Notifications
              </LinkComponent>
              {user.admin && (
                <LinkComponent Component={MenuItem} href='/admin/services' prefetch={false} onClick={handleClose}>
                  <ViewListIcon className={classes.menuItemIcon} /> Services
                </LinkComponent>
              )}
              <MenuItem onClick={handleLogout}>
                <ExitToAppIcon className={classes.menuItemIcon} /> Logout
              </MenuItem>
            </MenuStyled>
          </ProfileIconContainer>
          )
          ) || (
          <React.Fragment>
            <NextLink href='/login' prefetch={false}>
              <Button variant='outlined' sx={{ position: 'relative', ml: 3, mr: 1, float: 'right' }}>
                Login
              </Button>
            </NextLink>
            <IconButton
              aria-label='Switch theme'
              onClick={handleThemeChange}
              color='inherit'
              size='large'
            >
              {activeTheme === 2 ? <SunIcon /> : <MoonIcon />}
            </IconButton>
          </React.Fragment>
          )}
        </Toolbar>
      </AppBar>
    </Root>
  );
}

TopBar.propTypes = {
  activeTheme: PropTypes.number,
  setTheme: PropTypes.func,
};
export default TopBar;
