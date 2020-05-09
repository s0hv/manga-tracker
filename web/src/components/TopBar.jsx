import React from 'react';
import {makeStyles} from "@material-ui/core/styles";
import AccountCircle from '@material-ui/icons/AccountCircle';
import {
  AppBar,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@material-ui/core';
import Link from 'next/Link';
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
    }
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
}));

const MenuButton = React.forwardRef(({ href, prefetch, as, ...props }, ref) => {
  return (
    <Link href={href} prefetch={prefetch} as={as}>
      <MenuItem {...props} ref={ref}>
        {props.children}
      </MenuItem>
    </Link>
  )
})

function TopBar({ user }) {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    fetch('api/logout', {
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
          <Typography className={classes.title} variant="h6" noWrap>
            Manga tracker
          </Typography>
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
              <MenuButton href='/profile' prefetch={false} onClick={handleClose}>
                Profile
              </MenuButton>
              <MenuItem onClick={handleLogout}>
                Logout
              </MenuItem>
            </Menu>
          </div>
          ) ||
          <Link href='/login' prefetch={false}>
            <Button variant='outlined' className={classes.loginButton}>
              Login
            </Button>
          </Link>}
        </Toolbar>
      </AppBar>
    </div>
  );
}

export default TopBar;