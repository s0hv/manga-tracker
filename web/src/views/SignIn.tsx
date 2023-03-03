import React from 'react';
import {
  Avatar,
  Button,
  Container,
  Divider,
  Grid,
  Link,
  Typography,
} from '@mui/material';
import { LockOutlined as LockOutlinedIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { Field, Form } from 'react-final-form';
import { Checkboxes, TextField } from 'mui-rff';
import type {
  BuiltInProviderType,
  OAuthProviderButtonStyles,
} from 'next-auth/providers';
import type { ClientSafeProvider, LiteralUnion } from 'next-auth/react/types';
import { signIn } from 'next-auth/react';
import type { DefaultExcept } from '@/types/utility';
import { noop } from '@/webUtils/utilities';

import styles from './SignIn.module.css';

const Root = styled('div')(({ theme }) => ({
  marginTop: theme.spacing(8),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}));

const SignInForm = styled('form')(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

export type SignInProps = {
  providers: Partial<Record<LiteralUnion<BuiltInProviderType>, ClientSafeProvider>> | null
  _csrf?: string
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

export default function SignIn({ providers, _csrf }: SignInProps): React.ReactElement {
  const hasCredentials = Boolean(providers?.credentials);

  return (
    <Container component='main' maxWidth='xs'>
      <Root>
        <Avatar sx={{ m: 1, backgroundColor: 'secondary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component='h1' variant='h5'>
          Sign in
        </Typography>
        {Object.values(providers || {}).filter<ClientSafeProvider>(renderProvider).map(provider => {
          const providerStyle = getStyles(providerStyles[provider.id], true);
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
            <Form onSubmit={noop}>
              {() => (
                <SignInForm
                  method='post'
                  action='/api/auth/callback/credentials'
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
                    data={{ label: 'Remember me', value: undefined }}
                  />
                  <Field
                    name='csrfToken'
                    component='input'
                    type='hidden'
                    initialValue={_csrf}
                    defaultValue={_csrf}
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
                    <Grid item>
                      <Link href='#' variant='body2'>
                        To sign up login with your service of choice.
                        Creating traditional email + password accounts is not possible.
                      </Link>
                    </Grid>
                  </Grid>
                </SignInForm>
              )}
            </Form>
          </>
        )}
      </Root>
    </Container>
  );
}
