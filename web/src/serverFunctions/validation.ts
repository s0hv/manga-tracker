import { notFound, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

export const validateIsAdminUserFn = createServerFn()
  .handler(({ context }) => {
    if (context.user?.admin !== true) {
      throw notFound();
    }
  });

export const validateIsLoggedIn = createServerFn()
  .handler(({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/login' });
    }
  });
