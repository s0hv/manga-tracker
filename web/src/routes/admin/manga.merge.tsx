import { createFileRoute } from '@tanstack/react-router';

import MergeManga from '@/views/MergeManga';
import { defineMeta } from '@/webUtils/meta';

import { validateIsAdminUserFn } from '../../serverFunctions/validation';

export const Route = createFileRoute('/admin/manga/merge')({
  beforeLoad: async () => {
    await validateIsAdminUserFn();
  },
  head: () => ({
    meta: defineMeta({
      title: 'Merge manga',
      denyRobots: true,
    }),
  }),
  component: MergeManga,
});
