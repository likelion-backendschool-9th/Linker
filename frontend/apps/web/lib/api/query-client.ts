import { isServer, MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { cache } from 'react';

import { useAppSignalStore } from '@/stores/app-signal-store';

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
 * Timeouts (blueprint §5-5): if any loader registered via `useLoaderPresence` is on screen, the
 * screen failed to load, so the loading turns into the timeout screen (Figma 301:326) instead of a toast.
 * Otherwise (a background refetch, a side query with no loader) it is the shared timeout toast.
 * App-chrome queries (badge counts) mark `meta: { background: true }` and stay silent. Other codes as before.
 */
export function onQueryError(error: Error, query: { meta?: Record<string, unknown> }) {
  if (isTimeoutError(error) && query.meta?.background) return;
  if (isTimeoutError(error) && useAppSignalStore.getState().loadersMounted > 0) {
    useAppSignalStore.setState({ loadTimedOutAt: Date.now() });
    return;
  }
  handleApiError(error);
}

/**
 * A mutation that shows its own copy for some codes lists them in `meta.handledCodes`, so the shared
 * toast doesn't stack on top of it (e.g. 20's daily recruit-post limit). Everything else as before.
 */
export function onMutationError(
  error: Error,
  _variables: unknown,
  _onMutateResult: unknown,
  mutation: { meta?: Record<string, unknown> },
) {
  const handled = mutation.meta?.handledCodes;
  if (error instanceof ApiError && Array.isArray(handled) && handled.includes(error.code)) return;
  handleApiError(error);
}

function makeQueryClient(withErrorHandling: boolean) {
  return new QueryClient({
    queryCache: withErrorHandling ? new QueryCache({ onError: onQueryError }) : undefined,
    mutationCache: withErrorHandling ? new MutationCache({ onError: onMutationError }) : undefined,
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
