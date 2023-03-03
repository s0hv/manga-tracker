import type { GetServerSidePropsContext } from 'next';
import { getCsrfToken, getProviders } from 'next-auth/react';
import type { FC } from 'react';
import { NextSeo } from 'next-seo';
import SignIn, { type SignInProps } from '../views/SignIn';

const SignInPage: FC<SignInProps> = (props) => {
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

export async function getServerSideProps(context: GetServerSidePropsContext): Promise<{ props: SignInProps }> {
  return {
    props: {
      providers: await getProviders(),
      _csrf: await getCsrfToken(context),
    },
  };
}
