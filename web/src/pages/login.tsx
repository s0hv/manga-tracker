import type { FC } from 'react';
import type { GetServerSidePropsContext } from 'next';
import { getProviders } from 'next-auth/react';
import { NextSeo } from 'next-seo';


import SignIn, {
  type SignInPageErrorParam,
  type SignInProps,
} from '../views/SignIn';

const SignInPage: FC<SignInProps> = props => {
  return (
    <>
      <NextSeo
        title='Log in'
      />
      <SignIn {...props} />
    </>
  );
};

export default SignInPage;

export async function getServerSideProps({ query }: GetServerSidePropsContext): Promise<{ props: SignInProps }> {
  return {
    props: {
      providers: await getProviders(),
      error: (query.error as SignInPageErrorParam || null),
    },
  };
}
