import React from 'react';
import {
  Button,
  Container,
  FormHelperText,
  LinearProgress,
  Paper,
  Snackbar,
  TextField,
} from '@material-ui/core';
import MuiAlert from '@material-ui/lab/Alert';
import {makeStyles} from '@material-ui/core/styles';

// Rudimentary email check that check that your email is in the format of a@b.c
// I know you apparently can have multiple @ signs in your email but I don't care and filter those out
const emailRegex = /^(?!(.+?@{2,}.+?)|(.+?@.+?){2,}).+?@.+\.\w+$/;

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: '400px',
    minWidth: '300px',
    padding: theme.spacing(2),
  },
  form: {
    width: '100%', // Fix IE 11 issue.
    paddingTop: theme.spacing(8),
    paddingBottom: theme.spacing(4),
  },
  submit: {
    margin: theme.spacing(3, 0, 2),
  },
}));

function Alert(props) {
  return <MuiAlert elevation={6} variant='filled' {...props} />;
}

function ProfileView(props) {
  const {
    user = {},
  } = props;

  const [newPass, setNewPass] = React.useState(false);
  const [passwordGiven, setPasswordGiven] = React.useState(false);
  const [emailChanged, setEmailChanged] = React.useState(false);
  const [validEmail, setValidEmail] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [alertOpen, setAlertOpen] = React.useState(false);

  const classes = useStyles();

  const handleAlertClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    setAlertOpen(false);
  };

  const handleNewPassword = event => {
    if (event.target.value.length > 0) {
      setNewPass(true);
      return;
    }
    setNewPass(false);
  };

  const handleEmailChanged = event => {
    if (event.target.value.length > 0) {
      if (!emailChanged) setEmailChanged(true);
      setValidEmail(emailRegex.test(event.target.value));
      return;
    }

    setEmailChanged(false);
    setValidEmail(true);
  };

  const handleSubmit = event => {
    const data = new FormData(event.target);
    const body = new URLSearchParams();
    data.forEach((value, key) => body.append(key, value));
    setLoading(true);

    fetch('/api/profile',
      {
        method: 'post',
        body: body.toString(),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        },
      })
      .then(res => {
        // setLoading(false);
        setAlertOpen(true);
        if (res.status === 200) return;
        return res.json();
      })
      .then(json => setError(json?.error))
      .catch(err => {
        console.error(err);
        setLoading(false);
        setError('Unknown error');
      });

      event.preventDefault();
  };

  const passwordRequired = newPass || emailChanged;

  return (
    <Container maxWidth='lg'>
      <Paper className={classes.root}>
        <Container component='main' maxWidth='xs'>
          <form
            id='profileEditForm'
            className={classes.form}
            noValidate
            action='/api/profile'
            method='post'
            onSubmit={handleSubmit}
          >
            <TextField
              variant='outlined'
              margin='normal'
              required
              fullWidth
              id='username'
              label='Username'
              name='username'
              autoFocus
              defaultValue={user.username}
            />
            <TextField
              variant='outlined'
              margin='normal'
              fullWidth
              id='email'
              label='Email Address'
              name='email'
              autoComplete='email'
              autoFocus
              onChange={handleEmailChanged}
            />
            {emailChanged && !validEmail && (
            <FormHelperText error>
              Invalid email address
            </FormHelperText>
          )}
            <TextField
              variant='outlined'
              margin='normal'
              required={passwordRequired}
              fullWidth
              name='password'
              label='Password'
              type='password'
              id='current-password'
              onChange={event => setPasswordGiven(event.target.value.length > 0)}
              autoComplete='current-password'
            />
            {passwordRequired && !passwordGiven && (
            <FormHelperText error>
              Old password required
            </FormHelperText>
          )}
            <TextField
              variant='outlined'
              margin='normal'
              required
              fullWidth
              name='newPassword'
              label='New password'
              type='password'
              id='new-password'
              autoComplete='new-password'
              onChange={handleNewPassword}
            />
            <TextField
              variant='outlined'
              margin='normal'
              required
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
              // disabled={requirePassword}
              variant='contained'
              color='primary'
              className={classes.submit}
            >
              Update profile
            </Button>
            {loading && <LinearProgress variant='query' />}
            <Snackbar open={alertOpen} autoHideDuration={8000} onClose={handleAlertClose}>
              <Alert severity={error ? 'error' : 'success'} onClose={handleAlertClose}>
                { error || 'Successfully edited profile' }
              </Alert>
            </Snackbar>
          </form>
        </Container>
      </Paper>
    </Container>
  );
}

export default ProfileView;
