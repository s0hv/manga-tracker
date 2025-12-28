import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

import { getUserFollows } from '@/db/db';
import { getFollows } from '@/db/manga';

import { DatabaseIdSchema } from './common';

export const getFollowsFn = createServerFn().handler(({
  context,
}) => {
  if (!context.user) {
    throw redirect({ to: '/login' });
  }

  return getFollows(context.user.userId);
});


export const getUserFollowsFn = createServerFn()
  .inputValidator(DatabaseIdSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      return [];
    }

    const follows = await getUserFollows(context.user.userId, data);
    return follows.map(r => r.serviceId);
  });
