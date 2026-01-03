import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import NotFound from '@/views/NotFound';
import { getCspNonce } from '@/webUtils/routeUtils';

import { APIException, HTTPException } from './api/utilities';
import { routeTree } from './routeTree.gen';


export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof APIException || (error instanceof HTTPException && (error as HTTPException).statusCode >= 400)) {
            // Do not retry on client errors
            return false;
          }

          return failureCount < 3; // Retry up to 3 times for server errors
        },
      },
    },
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
