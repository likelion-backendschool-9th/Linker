'use client';

import { useEffect } from 'react';

import { useAppSignalStore } from '@/stores/app-signal-store';

/**
 * Counts this loading UI as "on screen" while mounted. A query timing out while any is up means the
 * screen failed to load, so it turns into the timeout screen (`query-client.ts`, blueprint §5-5).
 * Page `loading.tsx` skeletons should call this; the load-timeout orb also does via `LoadingOrb`.
 */
export function useLoaderPresence() {
  useEffect(() => {
    useAppSignalStore.setState((state) => ({ loadersMounted: state.loadersMounted + 1 }));
    return () =>
      useAppSignalStore.setState((state) => ({ loadersMounted: Math.max(0, state.loadersMounted - 1) }));
  }, []);
}
