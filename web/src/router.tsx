import {
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { HTTPError } from 'ky';

import NotFound from '@/views/NotFound';
import { getCspNonce } from '@/webUtils/routeUtils';
import {
  mutationCacheOnError,
  mutationCacheOnSuccess,
} from '@/webUtils/utilities';

import { APIException, HTTPException } from './api/utilities';
import { routeTree } from './routeTree.gen';


export function getRouter() {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      // Log query errors. Otherwise, query errors are not printed anywhere.
      onError: (error, query) => {
        console.error(`Query ${query.queryKey[0]} failed`, error);
      },
    }),

    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof APIException || (error instanceof HTTPException && (error as HTTPException).statusCode >= 400)) {
            // Do not retry on client errors
            return false;
          }

          if (error instanceof HTTPError) {
            // Do not retry ky requests
            return false;
          }

          return failureCount < 3; // Retry up to 3 times for server errors
        },
      },
    },

    mutationCache: new MutationCache({
      onSuccess: (_data, variables, _context, mutation) => {
        return mutationCacheOnSuccess(queryClient, variables, mutation);
      },

      onError: (_data, variables, _context, mutation) => {
        return mutationCacheOnError(queryClient, variables, mutation);
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultStructuralSharing: true,
    defaultNotFoundComponent: NotFound,
    ssr: {
      nonce: getCspNonce(),
    },
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
}
