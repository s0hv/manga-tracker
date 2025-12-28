import { createFileRoute, redirect } from '@tanstack/react-router';
import { ConfirmProvider } from 'material-ui-confirm';

import { defineMeta } from '@/webUtils/meta';
import { validateLoggedIn } from '@/webUtils/routeUtils';

import {
  fullUserProviderMiddleware,
  getFullUserFromRequest,
} from '../middleware/fullUserProviderMiddleware';
import type { FrontendUserForProfile } from '../store/userStore';
import ProfileView from '../views/Profile';

export const Route = createFileRoute('/profile')({
  component: Profile,
  head: () => ({
    meta: defineMeta({ title: 'Edit profile', denyRobots: true }),
  }),
  server: {
    middleware: [fullUserProviderMiddleware],
  },
  beforeLoad: async ({ serverContext, context }): Promise<{ profileUser: FrontendUserForProfile | null }> => {
    validateLoggedIn(context);

    const profileUser = serverContext
      ? serverContext.profileUser
      : await getFullUserFromRequest();

    if (!profileUser) {
      throw redirect({ to: '/login' });
    }

    return { profileUser };
  },
});

function Profile() {
  const ctx = Route.useRouteContext();

  return (
    <ConfirmProvider>
      <ProfileView user={ctx.profileUser} />
    </ConfirmProvider>
  );
}
