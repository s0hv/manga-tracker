import ProfileView from '../views/Profile';

export async function getServerSideProps({ req, res }) {
  if (!req.user || !req.user.user_id) {
    res.redirect('/login');
    return { props: {}};
  }

  return {
    props: {
      user: req.user,
    },
  };
}

export default ProfileView;
