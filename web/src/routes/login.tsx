import { createFileRoute } from '@tanstack/react-router';


import { SUPPORTED_OAUTH_PROVIDERS } from '@/common/auth/providers';
import { defineMeta } from '@/webUtils/meta';

import SignIn from '../views/SignIn';

export const Route = createFileRoute('/login')({
  component: SignInPage,
  head: () => ({
    meta: defineMeta({ title: 'Log in' }),
  }),
});


function SignInPage() {
  return <SignIn providers={SUPPORTED_OAUTH_PROVIDERS} />;
}
