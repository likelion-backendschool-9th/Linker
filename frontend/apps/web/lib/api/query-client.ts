import { isServer, MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { cache } from 'react';

import { ApiError } from './api-error';
import { isTimeoutError } from './fetch-with-timeout';
import { handleApiError } from './handle-api-error';

/**
 * One retry, but never for 4xx (the answer won't change and the shared handler would fire twice) nor
 * for a timeout (a second 10 s wait; the user gets the retry button instead).
 */
function retryOnce(failureCount: number, error: Error) {
  if (error instanceof ApiError && error.status < 500) return false;
  if (isTimeoutError(error)) return false;
  return failureCount < 1;
}

/**
 * A query that had nothing on screen yet shows its own failure UI (timeout screen, `ErrorState`), so the
 * shared timeout toast is only for a background refetch over data already shown. Other codes as before.
 */
function onQueryError(error: Error, query: { state: { data: unknown } }) {
  if (isTimeoutError(error) && query.state.data === undefined) return;
  handleApiError(error);
}

function makeQueryClient(withErrorHandling: boolean) {
  return new QueryClient({
    queryCache: withErrorHandling ? new QueryCache({ onError: onQueryError }) : undefined,
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
