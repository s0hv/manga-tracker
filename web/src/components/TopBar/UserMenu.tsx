import React, { type FC, useCallback } from 'react';
import AccountCircle from '@mui/icons-material/AccountCircle';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import MoonIcon from '@mui/icons-material/Brightness3';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonIcon from '@mui/icons-material/Person';
import ViewListIcon from '@mui/icons-material/ViewList';
import SunIcon from '@mui/icons-material/WbSunny';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { styled, useColorScheme } from '@mui/material/styles';

import { updateUserTheme } from '#web/api/user';
import { useIsUserAdmin } from '#web/store/userStore';
import { RouteLink } from '@/components/common/RouteLink';
import type { Theme } from '@/types/dbTypes';


const PREFIX = 'TopBar';
const classes = {
  menuItemIcon: `${PREFIX}-menuItemIcon`,
};

const MenuStyled = styled(Menu)(({ theme }) => ({
  [`& .${classes.menuItemIcon}`]: {
    marginRight: theme.spacing(1),
  },
}));

const ProfileIconContainer = styled('div')(({ theme }) => ({
  position: 'relative',
  marginLeft: theme.spacing(2),
  float: 'right',
}));

const signOut = () => {
  (document.getElementById('logout-form') as HTMLFormElement).submit();
};

export type UserMenuProps = {
  handleThemeChange: () => Theme
};

export const UserMenu: FC<UserMenuProps> = ({ handleThemeChange }) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const { mode, systemMode } = useColorScheme();
  const nextMode = (mode === 'system' ? systemMode : mode) === 'light' ? 'dark' : 'light';
  const isUserAdmin = useIsUserAdmin();

  const handleClick = useCallback((event?: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event?.currentTarget || null);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleUserThemeChange = useCallback(() => {
    handleClose();
    const val = handleThemeChange();

    updateUserTheme(val)
      .catch(console.error);
  }, [handleClose, handleThemeChange]);

  return (
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
        <RouteLink
          component={MenuItem}
          to='/profile'
          preload='intent'
          onClick={handleClose}
          sx={{ color: 'inherit' }}
          underline='none'
        >
          <PersonIcon className={classes.menuItemIcon} />
          {' '}
          Profile
        </RouteLink>

        <MenuItem onClick={handleUserThemeChange}>
          {nextMode === 'light'
            ? <SunIcon className={classes.menuItemIcon} />
            : <MoonIcon className={classes.menuItemIcon} />}
          Switch to
          {' '}
          {nextMode}
          {' '}
          theme
        </MenuItem>

        <RouteLink
          component={MenuItem}
          to='/follows'
          preload='intent'
          onClick={handleClose}
          sx={{ color: 'inherit' }}
          underline='none'
        >
          <BookmarksIcon className={classes.menuItemIcon} />
          {' '}
          Follows
        </RouteLink>

        <RouteLink
          component={MenuItem}
          to='/notifications'
          preload='intent'
          onClick={handleClose}
          sx={{ color: 'inherit' }}
          underline='none'
        >
          <NotificationsIcon className={classes.menuItemIcon} />
          {' '}
          Notifications
        </RouteLink>

        {isUserAdmin && (
          <RouteLink
            component={MenuItem}
            to='/admin/services'
            preload={false}
            onClick={handleClose}
            sx={{ color: 'inherit' }}
            underline='none'
          >
            <ViewListIcon className={classes.menuItemIcon} />
            {' '}
            Services
          </RouteLink>
        )}

        <MenuItem onClick={signOut}>
          <ExitToAppIcon className={classes.menuItemIcon} />
          {' '}
          Logout
        </MenuItem>

        <form
          action='/api/auth/logout'
          method='post'
          id='logout-form'
          style={{ display: 'none' }}
        />
      </MenuStyled>
    </ProfileIconContainer>
  );
};
