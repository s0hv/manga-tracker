import { NextSeo } from 'next-seo';
import NotificationsView from '../views/Notifications';

const Notifications = (props) => (
  <>
    <NextSeo
      title='New chapter notifications'
      nofollow
      noindex
    />
    <NotificationsView {...props} />
  </>
);

export default Notifications;

export async function getServerSideProps({ req }) {
  if (!req.user || !req.user.userId) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      }};
  }

  return {
    props: {
      user: req.user,
    },
  };
}
