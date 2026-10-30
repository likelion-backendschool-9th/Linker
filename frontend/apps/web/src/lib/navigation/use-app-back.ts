'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { getNavDepth } from './nav-depth';

/** Top-bar back: go back inside Linker, or replace to `fallbackHref` so a shared-link visitor never leaves (blueprint §7-5). */
export function useAppBack(fallbackHref: Route) {
  const router = useRouter();
  return () => {
    if (getNavDepth() > 0) router.back();
    else router.replace(fallbackHref);
  };
}
