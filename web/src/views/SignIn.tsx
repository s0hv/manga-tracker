import React, { useCallback } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Link,
  Typography,
} from '@mui/material';
import NextLink from 'next/link';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useColorScheme } from '@mui/material/styles';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';
import type {
  BuiltInProviderType,
  OAuthProviderButtonStyles,
} from 'next-auth/providers';
import type { ClientSafeProvider, LiteralUnion } from 'next-auth/react/types';
import { signIn } from 'next-auth/react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import type { DefaultExcept } from '@/types/utility';

import styles from './SignIn.module.css';

type SignInFormValues = {
  email: string
  password: string
  rememberme?: boolean
}

// https://github.com/nextauthjs/next-auth/blob/f6bb16b264f43a0afdbc6c26a2db6cd5c8e6030d/packages/core/src/types.ts#L294
export type SignInPageErrorParam =
  | 'Signin'
  | 'OAuthSignin'
  | 'OAuthCallback'
  | 'OAuthCreateAccount'
  | 'EmailCreateAccount'
  | 'Callback'
  | 'OAuthAccountNotLinked'
  | 'EmailSignin'
  | 'CredentialsSignin'
  | 'SessionRequired'

// This plus more from
// https://github.com/nextauthjs/next-auth/blob/f6bb16b264f43a0afdbc6c26a2db6cd5c8e6030d/packages/core/src/lib/pages/signin.tsx#L7
const signinErrors: Record<
  Lowercase<SignInPageErrorParam | 'default'>,
  string
> = {
  default: 'Unable to sign in.',
  signin: 'Try signing in with a different account.',
  oauthsignin: 'Try signing in with a different account.',
  oauthcallback: 'Try signing in with a different account.',
  oauthcreateaccount: 'Try signing in with a different account.',
  emailcreateaccount: 'Try signing in with a different account.',
  callback: 'Try signing in with a different account.',
  oauthaccountnotlinked:
    'To confirm your identity, sign in with the same account you used originally.',
  emailsignin: 'The e-mail could not be sent.',
  credentialssignin:
    'Sign in failed. Check the details you provided are correct.',
  sessionrequired: 'Please sign in to access this page.',
};

export type SignInProps = {
  providers?: Partial<Record<LiteralUnion<BuiltInProviderType>, ClientSafeProvider>> | null
  error?: SignInPageErrorParam | null
}

type OptionalLogoStyles = DefaultExcept<OAuthProviderButtonStyles, 'logoDark' | 'logo'>
const providerStyles: Partial<Record<LiteralUnion<BuiltInProviderType>, OptionalLogoStyles>> = {
  discord: {
    logo: 'https://authjs.dev/img/providers/discord.svg',
    logoDark: 'https://authjs.dev/img/providers/discord-dark.svg',
    bg: '#fff',
    text: '#7289DA',
    bgDark: '#7289DA',
    textDark: '#fff',
  },
  google: {
    logo: 'https://authjs.dev/img/providers/google.svg',
    logoDark: 'https://authjs.dev/img/providers/google.svg',
    bg: '#fff',
    text: '#000',
    bgDark: '#fff',
    textDark: '#000',
  },
} as const;

const renderProvider = (provider?: ClientSafeProvider): provider is ClientSafeProvider => provider !== undefined && provider.type !== 'credentials';

const defaultStyle: OptionalLogoStyles = {
  bg: '#fff',
  bgDark: '#000',
  text: '#000',
  textDark: '#fff',
};

const getStyles = (style: OptionalLogoStyles | undefined, darkTheme: boolean) => {
  if (!style) {
    style = defaultStyle;
  }

  if (darkTheme) {
    return {
      bg: style.bgDark,
      text: style.textDark,
      logo: style.logoDark,
    };
  }

  return {
    bg: style.bg,
    text: style.text,
    logo: style.logo,
  };
};

export default function SignIn({ providers, error: errorType }: SignInProps): React.ReactElement {
  const hasCredentials = Boolean(providers?.credentials);
  const { mode, systemMode } = useColorScheme();
  // Will always be undefined on server
  const currentMode = mode === 'system' ? systemMode : (mode ?? 'dark');

  const error =
    errorType &&
    (signinErrors[errorType.toLowerCase() as Lowercase<SignInPageErrorParam>] ??
      signinErrors.default);

  const { control, handleSubmit } = useForm<SignInFormValues>();

  const onSignIn = useCallback<SubmitHandler<SignInFormValues>>(values => {
    const previousPage = window.sessionStorage.getItem('previousPage') ?? undefined;
    return signIn(
      'credentials',
      {
        email: values.email,
        password: values.password,
        callbackUrl: previousPage,
        rememberme: values.rememberme,
      }
    );
  }, []);

  return (
    <Container component='main' maxWidth='xs' className={styles.container}>
      <Box sx={{
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
      >
        <Avatar sx={{ m: 1, backgroundColor: 'secondary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component='h1' variant='h5'>
          Sign in
        </Typography>
        {error && <Alert severity='error'>{error}</Alert>}
        <Typography sx={{ mb: 3 }}>
          An account is created when signing in if it does not already exist.<br />
          By signing up you accept the <NextLink href='/terms'>Terms</NextLink> and the <NextLink href='/privacy_policy'>Privacy Policy</NextLink>
        </Typography>
        {Object.values(providers || {}).filter<ClientSafeProvider>(renderProvider).map(provider => {
          const providerStyle = getStyles(providerStyles[provider.id], currentMode === 'dark');
          return (
            <div key={provider.id} className={styles.provider}>
              <button
                onClick={() => signIn(provider.id)}
                type='button'
                style={{
                  '--provider-bg': providerStyle.bg,
                  '--provider-text': providerStyle.text,
                } as React.CSSProperties}
              >
                {providerStyle.logo && <img loading='lazy' height={24} width={24} src={providerStyle.logo} alt={`${provider.name} logo`} />}
                <span>Sign in with {provider.name}</span>
              </button>
            </div>
          );
        })}
        {hasCredentials && (
          <>
            <Divider flexItem variant='middle'>OR</Divider>
            <Box
              component='form'
              sx={{ mt: 1 }}
              onSubmit={handleSubmit(onSignIn)}
            >
              <TextFieldElement
                control={control}
                variant='outlined'
                margin='normal'
                required
                fullWidth
                id='email'
                label='Email Address'
                name='email'
                type='email'
                autoComplete='email'
              />
              <TextFieldElement
                control={control}
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
              <CheckboxElement
                control={control}
                name='rememberme'
                id='rememberme'
                color='primary'
                label='Remember me'
                value='true'
              />
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
                <Grid>
                  <Link href='#' variant='body2'>
                    To sign up login with your service of choice.
                    Creating traditional email + password accounts is not possible.
                  </Link>
                </Grid>
              </Grid>
            </Box>
          </>
        )}
      </Box>
    </Container>
  );
}
