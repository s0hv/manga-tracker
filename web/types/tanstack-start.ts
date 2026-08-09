import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type {} from '@tanstack/react-start';
import '@tanstack/react-query';

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


interface MutationMeta extends Record<string, unknown> {
  queryKeysToInvalidate?: QueryKey[]
  invalidateOnError?: boolean
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: MutationMeta
  }
}
