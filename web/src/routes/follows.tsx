import React from 'react';
import { createFileRoute } from '@tanstack/react-router';

import Follows from '@/views/Follows';
import { defineMeta } from '@/webUtils/meta';

import { getFollowsFn } from '../serverFunctions/follows';


export const Route = createFileRoute('/follows')({
  loader: async () => {
    return getFollowsFn();
  },
  head: () => ({
    meta: defineMeta({
      title: 'Follows',
      denyRobots: true,
    }),
  }),
  component: FollowsPage,
});

function FollowsPage() {
  const follows = Route.useLoaderData();

  return <Follows follows={follows} />;
}
