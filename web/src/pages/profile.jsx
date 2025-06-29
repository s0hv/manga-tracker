import { ConfirmProvider } from 'material-ui-confirm';
import { NextSeo } from 'next-seo';

import ProfileView from '../views/Profile';

const Profile = props => (
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

export async function getServerSideProps({ req, res }) {
  if (!req.user || !req.user.userId) {
    res.redirect('/login');
    return { props: {}};
  }

  return {
    props: {
      user: req.user,
    },
  };
}
