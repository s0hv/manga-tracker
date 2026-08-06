import { createFileRoute } from '@tanstack/react-router';

import type { StaticPageContext } from '@/types/tanstack-start';
import { TermsOfService } from '@/views/static/TermsOfService';

export const Route = createFileRoute('/(static)/terms')({
  component: TermsOfService,
  context: (): StaticPageContext => ({ isStaticPage: true }),
});
