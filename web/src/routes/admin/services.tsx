import { createFileRoute } from '@tanstack/react-router';

import {
  DefaultLocalizationProvider,
} from '@/components/DefaultLocalizationProvider';
import Services from '@/views/admin/Services';
import { defineMeta } from '@/webUtils/meta';

import { getServicesFn } from '../../serverFunctions/services';
import { validateIsAdminUserFn } from '../../serverFunctions/validation';

export const Route = createFileRoute('/admin/services')({
  beforeLoad: async () => {
    await validateIsAdminUserFn();
  },
  loader: async () => {
    return getServicesFn();
  },
  head: () => ({
    meta: defineMeta({
      title: 'Services',
      denyRobots: true,
    }),
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const services = Route.useLoaderData();

  return (
    <DefaultLocalizationProvider>
      <Services services={services} />
    </DefaultLocalizationProvider>
  );
}
