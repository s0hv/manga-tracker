import { NextSeo } from 'next-seo';

import type { GetServerSidePropsExpress } from '@/types/nextjs';

import NotificationsView from '../views/Notifications';

const Notifications = () => (
  <>
    <NextSeo
      title='New chapter notifications'
      nofollow
      noindex
    />
    <NotificationsView />
  </>
);

export default Notifications;

export const getServerSideProps: GetServerSidePropsExpress = async ({ req }) => {
  if (!req.user || !req.user.userId) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      }};
  }

  return { props: {}};
};
