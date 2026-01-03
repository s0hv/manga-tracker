import { type ReactElement, useCallback } from 'react';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
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
import { useColorScheme } from '@mui/material/styles';
import { useNavigate } from '@tanstack/react-router';
import { HTTPError } from 'ky';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { CheckboxElement, TextFieldElement } from 'react-hook-form-mui';

import type { OAuthProvider } from '@/common/auth/providers';
import { RouteLink } from '@/components/common/RouteLink';

import { baseKy } from '../api/utilities';

import discordLogo from 'src/resources/Discord-Logo-Blurple.svg';
import discordLogoLight from 'src/resources/Discord-Logo-Light-Blurple.svg';


type SignInFormValues = {
  email: string
  password: string
  rememberMe?: boolean
};

export type SignInProps = {
  providers?: OAuthProvider[] | null
};

type ProviderStyle = {
  logo: string
  logoDark: string
  bg: string
  bgDark: string
};

const providerStyles = {
  discord: {
    logo: discordLogo,
    logoDark: discordLogoLight,
    bg: '#e0e3ff',
    bgDark: '#5865f2',
  },
} as const satisfies Record<OAuthProvider, ProviderStyle>;

const getStyles = (style: ProviderStyle, darkTheme: boolean): Pick<ProviderStyle, 'logo' | 'bg'> => {
  if (darkTheme) {
    return {
      bg: style.bgDark,
      logo: style.logoDark,
    };
  }

  return {
    bg: style.bg,
    logo: style.logo,
  };
};

export default function SignIn({ providers }: SignInProps): ReactElement {
  const { mode, systemMode } = useColorScheme();
  const navigate = useNavigate();
  // Will always be undefined on server
  const currentMode = mode === 'system' ? systemMode : (mode ?? 'dark');

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignInFormValues>();

  const onSignIn = useCallback<SubmitHandler<SignInFormValues>>(values => {
    return baseKy.post('auth/login', {
      headers: {
        'Content-Type': 'application/json',
      },
      json: values,
      // TODO this makes an unnecessary fetch to the redirect url. Maybe there's a better way to handle this.
      redirect: 'follow',
    })
      .then(res => {
        void navigate({ reloadDocument: true, to: new URL(res.url).pathname });
      })
      .catch(err => {
        if (err instanceof HTTPError) {
          let errorMessage: string;

          switch (err.response.status) {
            case 401:
              errorMessage = 'Invalid login';
              break;

            case 429:
              errorMessage = 'Ratelimited';
              break;

            default:
              errorMessage = err.response.statusText;
          }

          setError('root', { message: errorMessage });
        }
      });
  }, [navigate, setError]);

  return (
    <Container maxWidth='xs'>
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

        <Typography sx={{ mb: 3 }}>
          An account is created when signing in if it does not already exist.
          <br />
          By signing up you accept the
          {' '}
          <RouteLink to='/terms'>Terms</RouteLink>
          {' '}
          and the
          {' '}
          <RouteLink to='/privacy_policy'>Privacy Policy</RouteLink>
        </Typography>

        {providers?.map(provider => {
          const providerStyle = getStyles(providerStyles[provider], currentMode === 'dark');

          return (
            <Box
              key={provider}
              sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                px: 5,
                pb: '1rem',

                '& > a': {
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                },

                '& img': {
                  borderRadius: 2,
                  px: 3,
                  py: 2,
                },
              }}
            >
              <a
                href='/api/auth/discord'
                type='button'
              >
                <img
                  loading='lazy'
                  src={providerStyle.logo}
                  alt={`sign in with ${provider}`}
                  style={{ backgroundColor: providerStyle.bg }}
                />
              </a>
            </Box>
          );
        })}

        <Divider flexItem variant='middle'>OR</Divider>

        {errors.root && <Alert severity='error'>{errors.root.message}</Alert>}

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
            name='rememberMe'
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
      </Box>
    </Container>
  );
}
