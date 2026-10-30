import { isServer, QueryClient } from '@tanstack/react-query';
import { cache } from 'react';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: true },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/** Fresh per request on the server, one shared client in the browser (blueprint §9-3). */
const getServerQueryClient = cache(makeQueryClient);

export function getQueryClient() {
  if (isServer) return getServerQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
