import React from 'react';
import {
  Avatar,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  Grid,
  Link,
  makeStyles,
  Snackbar,
  TextField,
  Typography,
} from '@material-ui/core';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import MuiAlert from '@material-ui/lab/Alert';

function Alert(props) {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

const useStyles = makeStyles((theme) => ({
  paper: {
    marginTop: theme.spacing(8),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  avatar: {
    margin: theme.spacing(1),
    backgroundColor: theme.palette.secondary.main,
  },
  form: {
    width: '100%', // Fix IE 11 issue.
    marginTop: theme.spacing(1),
  },
  submit: {
    margin: theme.spacing(3, 0, 2),
  },
}));

export default function SignIn() {
  const classes = useStyles();
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleSubmit = function (event) {
    const data = new FormData(event.target);
    const body = new URLSearchParams();
    data.forEach((value, key) => body.append(key, value));

    fetch("/api/login",
      {
        method: 'post',
        body: body.toString(),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        },
        redirect: 'follow',
      }
    )
      .then(res => {
        console.debug(res);
        if (res.status === 200) {
          window.location.replace(res.url);
          return;
        }
        console.debug(res.status);
        return res.text();
      })
      .then(error => {
        if (!error) return;
        setError(error);
        setAlertOpen(true);
      })
      .catch(err => {
        console.error(err);
        setError('Unknown error');
        setAlertOpen(true);
      });

    event.preventDefault();
  }

  const handleAlertClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    setAlertOpen(false);
  };

  return (
    <Container component="main" maxWidth="xs">
      <div className={classes.paper}>
        <Avatar className={classes.avatar}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Sign in
        </Typography>
        <form
          className={classes.form}
          noValidate
          action="/api/login"
          method="post"
          onSubmit={handleSubmit}
        >
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
          />
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
          />
          <FormControlLabel
            control={<Checkbox
                name="rememberme"
                id="rememberme"
                type="checkbox"
                value="on"
                color="primary" />}
            label="Remember me"
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            className={classes.submit}
          >
            Sign In
          </Button>
          <Grid container>
            <Grid item xs>
              <Link href="#" variant="body2">
                Forgot password?
              </Link>
            </Grid>
            <Grid item>
              <Link href="#" variant="body2">
                {"Don't have an account? Sign Up"}
              </Link>
            </Grid>
          </Grid>
          <Snackbar open={alertOpen} autoHideDuration={8000} onClose={handleAlertClose}>
            <Alert severity={'error'} onClose={handleAlertClose}>
              { error }
            </Alert>
          </Snackbar>
        </form>
      </div>
    </Container>
  );
}