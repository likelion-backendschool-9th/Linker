'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** `false` on the server and during hydration, `true` after. Use instead of branching on `typeof window` in render. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
