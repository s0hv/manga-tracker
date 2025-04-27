import { IconButton, Menu, MenuItem } from '@mui/material';
import AccountCircle from '@mui/icons-material/AccountCircle';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import MoonIcon from '@mui/icons-material/Brightness3';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonIcon from '@mui/icons-material/Person';
import ViewListIcon from '@mui/icons-material/ViewList';
import SunIcon from '@mui/icons-material/WbSunny';
import React, { type FC, useCallback } from 'react';
import { styled, useColorScheme } from '@mui/material/styles';
import { signOut } from 'next-auth/react';
import { updateUserTheme } from '../../api/user';
import type { Theme } from '@/types/dbTypes';
import { LinkComponent } from '@/components/TopBar/LinkComponent';
import { useUser } from '@/webUtils/useUser';

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

const signOutMemo = () => signOut();

export type UserMenuProps = {
  handleThemeChange: () => Theme
}

export const UserMenu: FC<UserMenuProps> = ({ handleThemeChange }) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const { mode, systemMode } = useColorScheme();
  const nextMode = (mode === 'system' ? systemMode : mode) === 'light' ? 'dark' : 'light';
  const { user } = useUser();

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
        <LinkComponent
          Component={MenuItem}
          href='/profile'
          prefetch={false}
          onClick={handleClose}
        >
          <PersonIcon className={classes.menuItemIcon} /> Profile
        </LinkComponent>
        <MenuItem onClick={handleUserThemeChange}>
          {mode === 'dark' ? <SunIcon className={classes.menuItemIcon} /> :
          <MoonIcon className={classes.menuItemIcon} />}
          Switch to {nextMode} theme
        </MenuItem>
        <LinkComponent
          Component={MenuItem}
          href='/follows'
          prefetch={false}
          onClick={handleClose}
        >
          <BookmarksIcon className={classes.menuItemIcon} /> Follows
        </LinkComponent>
        <LinkComponent
          Component={MenuItem}
          href='/notifications'
          prefetch={false}
          onClick={handleClose}
        >
          <NotificationsIcon className={classes.menuItemIcon} /> Notifications
        </LinkComponent>
        {user!.admin && (
          <LinkComponent
            Component={MenuItem}
            href='/admin/services'
            prefetch={false}
            onClick={handleClose}
          >
            <ViewListIcon className={classes.menuItemIcon} /> Services
          </LinkComponent>
        )}
        <MenuItem onClick={signOutMemo}>
          <ExitToAppIcon className={classes.menuItemIcon} /> Logout
        </MenuItem>
      </MenuStyled>
    </ProfileIconContainer>
  );
};
