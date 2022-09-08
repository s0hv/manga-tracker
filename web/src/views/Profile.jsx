import { useSnackbar } from 'notistack';
import React, { useCallback, useMemo } from 'react';
import { Button, Container, LinearProgress, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Form } from 'react-final-form';
import { TextField, makeValidateSync, makeRequired } from 'mui-rff';
import * as Yup from 'yup';
import propTypes from 'prop-types';
import CSRFInput from '../components/utils/CSRFInput';
import { showErrorAlways } from '../utils/formUtils';
import { useCSRF } from '../utils/csrf';
import { updateUserProfile } from '../api/user';


const ProfileForm = styled('form')(({ theme }) => ({
  width: '100%',
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(4),
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

  const csrf = useCSRF();
  const { enqueueSnackbar } = useSnackbar();
  const onSubmit = useCallback((values) => updateUserProfile(csrf, values)
    .then(() => {
      enqueueSnackbar('Profile updated successfully', { variant: 'success' });
    })
    .catch(err => {
      enqueueSnackbar(err.message, { variant: 'error' });
      return { error: err.message };
    }), [enqueueSnackbar, csrf]);

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
      <Paper sx={{ minWidth: '300px', minHeight: '400px', p: 2 }}>
        <Container component='main' maxWidth='xs'>
          <Form
            onSubmit={onSubmit}
            validate={validate}
            initialValues={initialValues}
            subscription={subscription}
            render={({ handleSubmit, hasValidationErrors, submitting }) => (
              <ProfileForm
                id='profileEditForm'
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
                <CSRFInput />
                <Button
                  type='submit'
                  fullWidth
                  disabled={submitting || hasValidationErrors}
                  variant='contained'
                  color='primary'
                  sx={{ mt: 3, mb: 2 }}
                >
                  Update profile
                </Button>
                {submitting && <LinearProgress variant='query' />}
                {/* TODO Add alert on success or error */}
              </ProfileForm>
            )}
          />
        </Container>
      </Paper>
    </Container>
  );
};

Profile.propTypes = {
  user: propTypes.object,
};

export default Profile;
