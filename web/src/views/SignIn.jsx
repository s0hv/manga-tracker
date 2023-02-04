import { useSnackbar } from 'notistack';
import React from 'react';
import {
  Avatar,
  Button,
  Container,
  Grid,
  Link,
  Typography,
} from '@mui/material';
import { LockOutlined as LockOutlinedIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { Form } from 'react-final-form';
import { TextField, Checkboxes } from 'mui-rff';
import CSRFInput from '../components/utils/CSRFInput';
import { useCSRF } from '../utils/csrf';
import { loginUser } from '../api/user';
import { handleResponse, handleError } from '../api/utilities';


const Root = styled('div')(({ theme }) => ({
  marginTop: theme.spacing(8),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}));

const SignInForm = styled('form')(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

export default function SignIn() {
  const csrf = useCSRF();
  const { enqueueSnackbar } = useSnackbar();

  const onSubmit = data => loginUser(csrf, data)
    .then(res => {
      if (res.ok) {
        window.location.replace(res.url);
        return;
      }
      return handleResponse(res)
        .catch(handleError);
    })
    .catch(err => {
      enqueueSnackbar(err.message, { variant: 'error' });
      return { error: err.message };
    });

  return (
    <Container component='main' maxWidth='xs'>
      <Root>
        <Avatar sx={{ m: 1, backgroundColor: 'secondary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component='h1' variant='h5'>
          Sign in
        </Typography>
        <Form
          onSubmit={onSubmit}
        >
          {({ handleSubmit }) => (
            <SignInForm
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
                sx={{ mt: 3, mb: 2 }}
              >
                Sign In
              </Button>
              <Grid container>
                {/*                <Grid item xs>
                  <Link href='#' variant='body2'>
                    Forgot password?
                  </Link>
                </Grid> */}
                <Grid item>
                  <Link href='#' variant='body2'>
                    Sign ups are currently closed. If you know me you can just ask for an account.
                  </Link>
                </Grid>
              </Grid>
            </SignInForm>
          )}
        </Form>
      </Root>
    </Container>
  );
}
