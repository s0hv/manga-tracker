import { NextSeo } from 'next-seo';
import ProfileView from '../views/Profile';

const Profile = (props) => (
  <>
    <NextSeo
      title='Edit profile'
      nofollow
      noindex
    />
    <ProfileView {...props} />
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
