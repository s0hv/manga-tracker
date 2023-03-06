import { useSnackbar } from 'notistack';
import React, { useCallback, useMemo } from 'react';
import {
  Button,
  Container,
  LinearProgress,
  Paper,
  TextField as MuiTextField,
  Divider,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Form } from 'react-final-form';
import { TextField, makeValidateSync, makeRequired } from 'mui-rff';
import * as Yup from 'yup';
import propTypes from 'prop-types';
import { useConfirm } from 'material-ui-confirm';
import { signOut } from 'next-auth/react';
import CSRFInput from '../components/utils/CSRFInput';
import { showErrorAlways } from '../utils/formUtils';
import { useCSRF } from '../utils/csrf';
import { updateUserProfile, deleteAccount } from '../api/user.ts';


const ProfileForm = styled('form')(({ theme }) => ({
  width: '100%',
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(4),
}));

const schema = Yup.object().shape({
  username: Yup.string().required(),
  email: Yup.string().email(),
  password: Yup.string()
    .when(['newPassword'], {
      is: (pwd) => pwd?.length > 0,
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

  const isCredentialsAccount = Boolean(user.isCredentialsAccount);
  const csrf = useCSRF();
  const { enqueueSnackbar } = useSnackbar();
  const confirm = useConfirm();
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

  const deleteAccountDialog = useCallback(() => {
    const confirmationKeyword = user.username || 'I understand';
    confirm(({
      description: <Typography sx={{ mb: 2 }}>This action is permanent and irreversible.<br /> Type {`"${confirmationKeyword}"`} to acknowledge this.</Typography>,
      title: 'Delete account permanently?',
      confirmationKeyword,
      confirmationText: `Delete account`,
    }))
      .then(() => {
        deleteAccount(csrf)
          .then(() => signOut())
          .catch(() => {
            enqueueSnackbar('Failed to delete account due to an unknown error', {
              variant: 'error',
            });
          });
      });
  }, [confirm, csrf, enqueueSnackbar, user.username]);

  const requestDataDialog = useCallback((event) => {
    event.preventDefault();
    confirm({
      title: 'Request for collected personal data',
      description: (
        `
          You are about to download a copy of the data stored of you on this service.
          The data package might contain sensitive data so take the necessary precautions while handling it.
          After proceeding it is on your responsibity to take care of proper handling of the provided data.
        `
      ),
      confirmationText: 'Proceed',
    })
      .then(() => {
        event.target.submit();
      });
  }, [confirm]);

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
                <MuiTextField
                  variant='outlined'
                  margin='normal'
                  fullWidth
                  label='Email Address'
                  disabled
                  value={initialValues.email}
                  helperText={`Changing email is not possible ${isCredentialsAccount ? 'for a credentials based account' : 'when using third parties for login'}`}
                  required={required.email}
                />
                {isCredentialsAccount && (
                  <>
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
                  </>
                )}
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
          <Divider sx={{ mt: 5, mb: 5 }} />
          <form
            onSubmit={requestDataDialog}
            method='POST'
            action='/api/user/dataRequest'
          >
            <input type='hidden' value={csrf} name='_csrf' />
            <Button
              fullWidth
              type='submit'
              variant='contained'
              color='primary'
              sx={{ mt: 3, mb: 2 }}
            >
              Download a copy of personal data
            </Button>
          </form>
          <Button
            fullWidth
            variant='contained'
            color='error'
            onClick={deleteAccountDialog}
            sx={{ mt: 3, mb: 2 }}
          >
            Delete account
          </Button>
        </Container>
      </Paper>
    </Container>
  );
};

Profile.propTypes = {
  user: propTypes.object,
};

export default Profile;
