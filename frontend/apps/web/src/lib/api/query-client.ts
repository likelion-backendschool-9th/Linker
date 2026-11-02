import { isServer, MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { cache } from 'react';

import { ApiError } from './api-error';
import { handleApiError } from './handle-api-error';

/** One retry, but never for 4xx: the answer won't change and the shared handler would fire twice. */
function retryOnce(failureCount: number, error: Error) {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 1;
}

function makeQueryClient(withErrorHandling: boolean) {
  return new QueryClient({
    queryCache: withErrorHandling ? new QueryCache({ onError: handleApiError }) : undefined,
    mutationCache: withErrorHandling ? new MutationCache({ onError: handleApiError }) : undefined,
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: retryOnce,
        refetchOnWindowFocus: true,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/** Fresh per request on the server, one shared client in the browser (blueprint §9-3). */
const getServerQueryClient = cache(() => makeQueryClient(false));

export function getQueryClient() {
  if (isServer) return getServerQueryClient();
  browserQueryClient ??= makeQueryClient(true);
  return browserQueryClient;
}
