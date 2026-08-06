import { createFileRoute } from '@tanstack/react-router';

import type { StaticPageContext } from '@/types/tanstack-start';
import { PrivacyPolicy } from '@/views/static/PrivacyPolicy';

export const Route = createFileRoute('/(static)/privacy_policy')({
  component: PrivacyPolicy,
  context: (): StaticPageContext => ({ isStaticPage: true }),
});
