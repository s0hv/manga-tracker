import React, {
  type FC,
  type FormEvent,
  useCallback,
  useMemo,
} from 'react';
import {
  Box,
  Button,
  Container,
  Divider,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { useConfirm } from 'material-ui-confirm';
import { signOut } from 'next-auth/react';
import { useSnackbar } from 'notistack';
import {
  type DefaultValues,
  type SubmitHandler,
  FormProvider,
  useForm,
} from 'react-hook-form';
import { TextFieldElement } from 'react-hook-form-mui';
import { z } from 'zod';


import type { SessionUser } from '@/types/dbTypes';

import { deleteAccount, updateUserProfile } from '../api/user';

const zodSchema = z.object({
  username: z.string().min(1),
  email: z.string().optional(),
  password: z.string().optional(),
  newPassword: z.string().optional(),
  repeatPassword: z.string().optional(),
})
  .check(ctx => {
    const data = ctx.value;
    if ((data.newPassword ?? '') !== (data.repeatPassword ?? '')) {
      ctx.issues.push({
        code: 'custom',
        path: ['repeatPassword'],
        message: 'Passwords must match',
        input: data.repeatPassword,
      });
    }

    const passwordValid = !data.newPassword || (data.password?.length ?? 0) > 0;
    if (!passwordValid) {
      ctx.issues.push({
        code: 'custom',
        path: ['password'],
        message: 'Password is required when changing password',
        input: data.password,
      });
    }
  });
type ProfileFormValues = z.infer<typeof zodSchema>;

const resolver = zodResolver(zodSchema);

type ProfileProps = {
  user?: SessionUser
};
const Profile: FC<ProfileProps> = props => {
  const {
    user = ({} as Partial<SessionUser>),
  } = props;

  const isCredentialsAccount = Boolean(user.isCredentialsAccount);
  const { enqueueSnackbar } = useSnackbar();
  const confirm = useConfirm();

  const initialValues = useMemo<DefaultValues<ProfileFormValues>>(() => ({
    username: user.username,
    email: user.email as string | undefined,
  }), [user]);

  const {
    formState,
    control,
    ...methods
  } = useForm<ProfileFormValues>({
    resolver,
    defaultValues: initialValues,
    mode: 'onBlur',
  });

  const onSubmit = useCallback<SubmitHandler<ProfileFormValues>>(values => updateUserProfile(values)
    .then(() => {
      enqueueSnackbar('Profile updated successfully', { variant: 'success' });
    })
    .catch(err => {
      enqueueSnackbar(err.message, { variant: 'error' });
      return { error: err.message };
    }), [enqueueSnackbar]);


  const { isSubmitting, isValid } = formState;

  const deleteAccountDialog = useCallback(() => {
    const confirmationKeyword = user.username || 'I understand';
    confirm(({
      content: (
        <Typography sx={{ mb: 2 }} color='textSecondary'>
          This action is permanent and irreversible.
          <br />
          {' '}
          Type
          {` "${confirmationKeyword}" `}
          to acknowledge this.
        </Typography>
      ),
      title: 'Delete account permanently?',
      confirmationKeyword,
      confirmationText: `Delete account`,
    }))
      .then(({ confirmed }) => {
        if (!confirmed) return;

        return deleteAccount()
          .then(() => signOut())
          .catch(() => {
            enqueueSnackbar('Failed to delete account due to an unknown error', {
              variant: 'error',
            });
          });
      });
  }, [confirm, enqueueSnackbar, user.username]);

  const requestDataDialog = useCallback((event: FormEvent<HTMLFormElement>) => {
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
      .then(({ confirmed }) => {
        if (!confirmed) return;
        (event.target as HTMLFormElement).submit();
      });
  }, [confirm]);

  return (
    <Container maxWidth='lg'>
      <Paper sx={{ minWidth: '300px', minHeight: '400px', p: 2 }}>
        <Container maxWidth='xs'>
          <FormProvider
            formState={formState}
            control={control}
            {...methods}
          >
            <Box
              component='form'
              noValidate
              id='profileEditForm'
              onSubmit={methods.handleSubmit(onSubmit)}
              sx={{
                width: '100%',
                paddingTop: 8,
                paddingBottom: 4,
              }}
            >
              <TextFieldElement
                variant='outlined'
                margin='normal'
                fullWidth
                id='username'
                name='username'
                label='Username'
                autoFocus
                control={control}
              />

              <TextFieldElement
                variant='outlined'
                name='email'
                margin='normal'
                fullWidth
                disabled
                label='Email Address'
                control={control}
                helperText={`Changing email is not possible ${isCredentialsAccount ? 'for a credentials based account' : 'when using third parties for login'}`}
              />

              {isCredentialsAccount && (
                <>
                  <TextFieldElement
                    variant='outlined'
                    margin='normal'
                    fullWidth
                    name='password'
                    label='Password'
                    type='password'
                    id='current-password'
                    autoComplete='current-password'
                    control={control}
                  />

                  <TextFieldElement
                    variant='outlined'
                    margin='normal'
                    fullWidth
                    name='newPassword'
                    label='New password'
                    type='password'
                    id='new-password'
                    autoComplete='new-password'
                    control={control}
                    rules={{
                      deps: ['password'],
                    }}
                  />

                  <TextFieldElement
                    variant='outlined'
                    margin='normal'
                    fullWidth
                    name='repeatPassword'
                    label='New password again'
                    type='password'
                    id='repeat-password'
                    autoComplete='new-password'
                    control={control}
                    rules={{
                      deps: ['newPassword'],
                    }}
                  />
                </>
              )}
              <Button
                type='submit'
                fullWidth
                disabled={isSubmitting || !isValid}
                variant='contained'
                color='primary'
                sx={{ mt: 3, mb: 2 }}
              >
                Update profile
              </Button>
              {isSubmitting && <LinearProgress variant='query' />}
              {/* TODO Add alert on success or error */}
            </Box>
          </FormProvider>

          <Divider sx={{ mt: 5, mb: 5 }} />

          <form
            onSubmit={requestDataDialog}
            method='POST'
            action='/api/user/dataRequest'
          >
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

export default Profile;
