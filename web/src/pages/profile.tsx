import { ConfirmProvider } from 'material-ui-confirm';
import { NextSeo } from 'next-seo';

import type { SessionUser } from '@/types/dbTypes';
import type { GetServerSidePropsExpress } from '@/types/nextjs';

import ProfileView from '../views/Profile';

type Props = {
  user: SessionUser
};

const Profile = (props: Props) => (
  <>
    <NextSeo
      title='Edit profile'
      nofollow
      noindex
    />
    <ConfirmProvider>
      <ProfileView {...props} />
    </ConfirmProvider>
  </>
);

export default Profile;

export const getServerSideProps: GetServerSidePropsExpress<Props> = async ({ req, res }) => {
  if (!req.user || !req.user.userId) {
    res.redirect('/login');
    return { props: {} as Props };
  }

  return {
    props: {
      user: req.user!,
    },
  };
};
