import { useSnackbar } from 'notistack';
import React, { useCallback, useMemo } from 'react';
import {
  Button,
  Container,
  LinearProgress,
  Paper,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Form } from 'react-final-form';
import {
  TextField,
  makeValidateSync,
  makeRequired,
} from 'mui-rff';
import * as Yup from 'yup';
import { showErrorAlways } from '../utils/formUtils';


const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: '400px',
    minWidth: '300px',
    padding: theme.spacing(2),
  },
  form: {
    width: '100%',
    paddingTop: theme.spacing(8),
    paddingBottom: theme.spacing(4),
  },
  submit: {
    margin: theme.spacing(3, 0, 2),
  },
}));

const schema = Yup.object().shape({
  username: Yup.string().required(),
  email: Yup.string().email(),
  password: Yup.string()
    .when(['newPassword', 'email'], {
      is: (pwd, email) => pwd?.length > 0 || email?.length > 0,
      then: Yup.string().required(),
    }),
  newPassword: Yup.string(),
  repeatPassword: Yup.string()
    .oneOf([Yup.ref('newPassword'), undefined], 'Passwords must match'),
});

const validate = makeValidateSync(schema);
const required = makeRequired(schema);

const Profile = (props) => {
  const {
    user = {},
  } = props;

  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();
  const onSubmit = useCallback((values) => fetch('/api/profile',
    {
      method: 'post',
      body: JSON.stringify(values),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
    .then(res => {
      if (res.status === 200) {
        enqueueSnackbar('Profile updated successfully', { variant: 'success' });
        return;
      }
      return res.json();
    })
    .then(json => {
      if (json?.error) {
        enqueueSnackbar(json.error, { variant: 'error' });
        return { error: json.error };
      }
    })
    .catch(err => {
      enqueueSnackbar(err.message, { variant: 'error' });
      return { error: err.message };
    }), [enqueueSnackbar]);

  const initialValues = useMemo(() => ({
    username: user.username,
    email: user.email,
  }), [user]);

  const subscription = useMemo(() => ({
    submitting: true,
    hasValidationErrors: true,
  }), []);

  return (
    <Container maxWidth='lg'>
      <Paper className={classes.root}>
        <Container component='main' maxWidth='xs'>
          <Form
            onSubmit={onSubmit}
            validate={validate}
            initialValues={initialValues}
            subscription={subscription}
            render={({ handleSubmit, hasValidationErrors, submitting }) => (
              <form
                id='profileEditForm'
                className={classes.form}
                noValidate
                onSubmit={handleSubmit}
              >
                <TextField
                  variant='outlined'
                  margin='normal'
                  required={required.username}
                  fullWidth
                  id='username'
                  name='username'
                  label='Username'
                  autoFocus
                />
                <TextField
                  variant='outlined'
                  margin='normal'
                  fullWidth
                  id='email'
                  label='Email Address'
                  name='email'
                  type='email'
                  autoComplete='email'
                  autoFocus
                  required={required.email}
                />
                <TextField
                  variant='outlined'
                  margin='normal'
                  fullWidth
                  name='password'
                  label='Password'
                  type='password'
                  id='current-password'
                  autoComplete='current-password'
                  required={required.password}
                  showError={showErrorAlways}
                />
                <TextField
                  variant='outlined'
                  margin='normal'
                  fullWidth
                  name='newPassword'
                  label='New password'
                  type='password'
                  id='new-password'
                  autoComplete='new-password'
                  required={required.newPassword}
                />
                <TextField
                  variant='outlined'
                  margin='normal'
                  required={required.repeatPassword}
                  fullWidth
                  name='repeatPassword'
                  label='New password again'
                  type='password'
                  id='repeat-password'
                  autoComplete='new-password'
                />
                <Button
                  type='submit'
                  fullWidth
                  disabled={submitting || hasValidationErrors}
                  variant='contained'
                  color='primary'
                  className={classes.submit}
                >
                  Update profile
                </Button>
                {submitting && <LinearProgress variant='query' />}
                {/* TODO Add alert on success or error */}
              </form>
            )}
          />
        </Container>
      </Paper>
    </Container>
  );
};

export default Profile;
