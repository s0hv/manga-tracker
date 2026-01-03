import { createFileRoute } from '@tanstack/react-router';

import { defineMeta } from '@/webUtils/meta';
import { validateLoggedIn } from '@/webUtils/routeUtils';

import Notifications from '../views/Notifications';

export const Route = createFileRoute('/notifications')({
  beforeLoad: ({ context }) => validateLoggedIn(context),
  head: () => ({
    meta: defineMeta({ title: 'New chapter notifications', denyRobots: true }),
  }),
  component: Notifications,
});
