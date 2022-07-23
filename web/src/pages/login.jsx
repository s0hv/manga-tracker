import { NextSeo } from 'next-seo';
import SignIn from '../views/SignIn';

const SignInPage = (props) => (
  <>
    <NextSeo
      title='Log in'
    />
    <SignIn {...props} />
  </>
);

export default SignInPage;
