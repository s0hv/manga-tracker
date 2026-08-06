import { createFileRoute } from '@tanstack/react-router';

import type { StaticPageContext } from '@/types/tanstack-start';
import { ThirdPartyNotices } from '@/views/static/ThirdPartyNotices';

export const Route = createFileRoute('/(static)/third_party_notices')({
  component: ThirdPartyNotices,
  context: (): StaticPageContext => ({ isStaticPage: true }),
});

