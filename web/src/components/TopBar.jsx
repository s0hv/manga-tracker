import React from 'react';
import {
  AccountCircle,
  Bookmarks as BookmarksIcon,
  Brightness3 as MoonIcon,
  ExitToApp as ExitToAppIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  WbSunny as SunIcon
} from '@material-ui/icons';
import {
  AppBar,
  Button,
  IconButton,
  makeStyles,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@material-ui/core';
import NextLink from 'next/link';
import SearchInput from './Search';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    position: 'sticky',
    width: '100%',
    minWidth: '300px',
    left: 0,
  },
  grow: {
    flexGrow: 1,
  },
  title: {
    flexGrow: 1,
    marginRight: theme.spacing(2),
    [theme.breakpoints.down(500)]: {
      display: 'none',
    },
    cursor: 'pointer',
  },
  titleIcon: {
    flexGrow: 1,
    marginRight: theme.spacing(1),
    justifyContent: 'flex-start',

    [theme.breakpoints.up(500)]: {
      display: 'none',
    },
  },
  profileIcon: {
    position: "relative",
    marginLeft: theme.spacing(2),
    float: "right",
  },
  loginButton: {
    position: "relative",
    marginLeft: theme.spacing(3),
    float: "right",
  },
  popper: {
    zIndex: theme.zIndex.modal,
    marginTop: '10px',
    width: '200px',
    [theme.breakpoints.up('sm')]: {
      width: '450px',
    },
  },
  menuItemIcon: {
    marginRight: theme.spacing(1),
  },
  menuLink: {
    textDecoration: 'none',
    color: 'inherit',
  }
}));

const LinkComponent = React.forwardRef(({ href, prefetch, as, Component, children, passHref=false, ...props }, ref) => {
  return (
    <NextLink href={href} prefetch={prefetch} as={as} passHref={passHref}>
      <a style={{textDecoration: 'none', color:'inherit'}}>
        <Component {...props} ref={ref}>
          {children}
        </Component>
      </a>
    </NextLink>
  )
});

function TopBar(props) {
  const {
    user,
    activeTheme,
    setTheme
  } = props;
  const classes = useStyles();
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
    const val = activeTheme === 1 ? 2 : 1
    setTheme(val);
    fetch( `/api/settings/theme?value=${val}`, {
      method: 'post',
      credentials: 'include'
    })
      .catch(console.error)
  }

  const handleLogout = () => {
    handleClose();
    fetch('/api/logout', {
      method: 'post',
      credentials: 'include',
    })
      .then(res => {
        console.log(res)
        window.location.replace(res.url);
      })
      .catch(err => {
        window.location.reload();
        console.error(err);
      })
  }


  return (
    <div className={classes.root}>
      <AppBar position="static">
        <Toolbar>
          <NextLink href='/' prefetch={false}>
            <Typography className={classes.title} variant="h6" noWrap>
              Manga tracker
            </Typography>
          </NextLink>
          <LinkComponent
              Component={IconButton}
              href='/'
              prefetch={false}
              className={classes.titleIcon}
              aria-label="return to home page"
              aria-controls="menu-appbar"
              color="inherit"
          >
            <HomeIcon />
          </LinkComponent>
          <div className={classes.grow}/>
          <SearchInput id="title-search"/>
          {(user &&
          <div className={classes.profileIcon}>
            <IconButton
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleClick}
                color="inherit"
            >
              <AccountCircle fontSize='large'/>
            </IconButton>
            <Menu
                id="menu-appbar"
                disableScrollLock={true}
                anchorEl={anchorEl}
                elevation={0}
                getContentAnchorEl={null}
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
              <LinkComponent Component={MenuItem} href='/profile' prefetch={false} onClick={handleClose} passHref>
                <PersonIcon className={classes.menuItemIcon}/> Profile
              </LinkComponent>
              <MenuItem onClick={handleThemeChange}>
                { activeTheme === 2 ? <SunIcon className={classes.menuItemIcon}/> : <MoonIcon className={classes.menuItemIcon}/>}
                Switch to {activeTheme === 2 ? 'light' : 'dark'} theme
              </MenuItem>
              <LinkComponent Component={MenuItem} href='/follows' prefetch={false} onClick={handleClose} passHref>
                <BookmarksIcon className={classes.menuItemIcon}/> Follows
              </LinkComponent>
              <MenuItem onClick={handleLogout}>
                <ExitToAppIcon className={classes.menuItemIcon}/> Logout
              </MenuItem>
            </Menu>
          </div>
          ) ||
          <React.Fragment>
            <NextLink href='/login' prefetch={false}>
              <Button variant='outlined' className={classes.loginButton}>
                Login
              </Button>
            </NextLink>
            <IconButton
              aria-label="Switch theme"
              onClick={handleThemeChange}
              color="inherit"
            >
              {activeTheme === 2 ? <SunIcon className={classes.menuItemIcon}/> : <MoonIcon className={classes.menuItemIcon}/>}
            </IconButton>
          </React.Fragment>}
        </Toolbar>
      </AppBar>
    </div>
  );
}

export default TopBar;