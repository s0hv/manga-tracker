import { createFileRoute } from '@tanstack/react-router';
import { ConfirmProvider } from 'material-ui-confirm';

import { getServicesFn } from '#web/serverFunctions/services';
import { validateIsAdminUserFn } from '#web/serverFunctions/validation';
import {
  DefaultLocalizationProvider,
} from '@/components/DefaultLocalizationProvider';
import { ChaptersFailed } from '@/views/admin/ChaptersFailed';
import { defineMeta } from '@/webUtils/meta';


export const Route = createFileRoute('/admin/parsing-fails')({
  beforeLoad: async () => {
    await validateIsAdminUserFn();
  },
  loader: async () => {
    return getServicesFn();
  },
  head: () => ({
    meta: defineMeta({
      title: 'Parsing fail management',
      denyRobots: true,
    }),
  }),
  component: ParsingFails,
});

function ParsingFails() {
  return (
    <DefaultLocalizationProvider>
      <ConfirmProvider>
        <ChaptersFailed />
      </ConfirmProvider>
    </DefaultLocalizationProvider>
  );
}
