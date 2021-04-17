import { useSnackbar } from 'notistack';
import React from 'react';
import {
  Avatar,
  Button,
  Container,
  Grid,
  Link,
  Typography,
} from '@material-ui/core';
import { LockOutlined as LockOutlinedIcon } from '@material-ui/icons';
import { makeStyles } from '@material-ui/core/styles';
import { Form } from 'react-final-form';
import {
  TextField,
  Checkboxes,
} from 'mui-rff';
import CSRFInput from '../components/utils/CSRFInput';
import { csrfHeader, useCSRF } from '../utils/csrf';


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
  const csrf = useCSRF();
  const { enqueueSnackbar } = useSnackbar();

  const onSubmit = data => fetch('/api/login',
    {
      method: 'post',
      body: JSON.stringify(data),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...csrfHeader(csrf),
      },
      redirect: 'follow',
    })
    .then(res => {
      if (res.status === 200) {
        window.location.replace(res.url);
        return;
      }
      return res.text();
    })
    .then(err => {
      if (!err) return;
      enqueueSnackbar(err, { variant: 'error' });
      return { error: err };
    })
    .catch(err => {
      console.error(err);
      enqueueSnackbar('Unknown error', { variant: 'error' });
      return { error: err.message };
    });

  return (
    <Container component='main' maxWidth='xs'>
      <div className={classes.paper}>
        <Avatar className={classes.avatar}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component='h1' variant='h5'>
          Sign in
        </Typography>
        <Form
          onSubmit={onSubmit}
        >
          {({ handleSubmit }) => (
            <form
              className={classes.form}
              onSubmit={handleSubmit}
            >
              <TextField
                variant='outlined'
                margin='normal'
                required
                fullWidth
                id='email'
                label='Email Address'
                name='email'
                type='email'
                autoComplete='email'
                autoFocus
              />
              <TextField
                variant='outlined'
                margin='normal'
                required
                fullWidth
                name='password'
                label='Password'
                type='password'
                id='password'
                autoComplete='current-password'
              />
              <Checkboxes
                name='rememberme'
                id='rememberme'
                color='primary'
                data={{ label: 'Remember me' }}
              />
              <CSRFInput />
              <Button
                type='submit'
                fullWidth
                variant='contained'
                color='primary'
                className={classes.submit}
              >
                Sign In
              </Button>
              <Grid container>
                <Grid item xs>
                  <Link href='#' variant='body2'>
                    Forgot password?
                  </Link>
                </Grid>
                <Grid item>
                  <Link href='#' variant='body2'>
                    {/* eslint-disable-next-line react/jsx-curly-brace-presence */}
                    {"Don't have an account? Sign Up"}
                  </Link>
                </Grid>
              </Grid>
            </form>
          )}
        </Form>
      </div>
    </Container>
  );
}
