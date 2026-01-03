import type { QueryClient } from '@tanstack/react-query';
import type {} from '@tanstack/react-start';

import type { SessionUser } from '@/types/dbTypes';
import type { SafeSession } from '@/types/session';

export interface RouterContext {
  isStaticPage?: boolean
  queryClient: QueryClient
}

export interface StaticPageContext {
  isStaticPage: true
}

export interface RequestContext {
  session: SafeSession | null
  user: SessionUser | null
  nonce: string
}

declare module '@tanstack/react-start' {
  interface Register {
    server: {
      requestContext: RequestContext
    }
  }
}
