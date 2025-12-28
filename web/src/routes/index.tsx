import { createFileRoute } from '@tanstack/react-router';

import MainApp from '@/views/App';
import { defineMeta } from '@/webUtils/meta';


export const Route = createFileRoute('/')({
  component: MainApp,
  head: () => ({
    meta: defineMeta({ title: '' }),
  }),
});
