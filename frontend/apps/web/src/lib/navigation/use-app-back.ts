'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { useOverlay } from './use-overlay';
import { getNavDepth } from './nav-depth';
import { useUnsavedChangesStore } from '@/stores/unsaved-changes-store';

/** Top-bar back: go back inside Linker, or replace to `fallbackHref` so a shared-link visitor never leaves (blueprint §7-5). */
export function useAppBack(fallbackHref: Route) {
  const router = useRouter();
  const leaveConfirmation = useOverlay('profile-leave');
  return () => {
    if (useUnsavedChangesStore.getState().isDirty) {
      leaveConfirmation.open();
      return;
    }
    if (getNavDepth() > 0) router.back();
    else router.replace(fallbackHref);
  };
}
