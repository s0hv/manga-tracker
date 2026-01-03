import { createMiddleware, createServerFn } from '@tanstack/react-start';

import type { SessionUser } from '@/types/dbTypes';

import type { FrontendUserForProfile } from '../store/userStore';

export const getFullUserFromRequest = createServerFn().handler(({
  context,
}) => {
  return getFrontendUserForProfileFromSessionUser(context.user);
});


export const fullUserProviderMiddleware = createMiddleware().server(({
  context,
  next,
}) => {
  return next({
    context: {
      profileUser: getFrontendUserForProfileFromSessionUser(context.user),
    },
  });
});

function getFrontendUserForProfileFromSessionUser(user: SessionUser | null): FrontendUserForProfile | null {
  if (!user) return null;

  return {
    username: user.username,
    uuid: user.userUuid,
    theme: user.theme,
    admin: user.admin,
    email: user.email,
    isCredentialsAccount: user.isCredentialsAccount,
  };
}
