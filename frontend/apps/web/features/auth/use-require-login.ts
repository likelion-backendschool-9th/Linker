'use client';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

/**
 * Every guest "prompt" cell of 04 POL-A-9 goes through this (blueprint §4-5):
 * `onClick={() => requireLogin() && like.mutate(...)}`. Guests get the login sheet and `false`.
 * After login they return to the current screen, or to `returnTo` when given (bottom tabs).
 */
export function useRequireLogin() {
  const { role } = useViewer();
  const loginSheet = useOverlay('login');

  return (returnTo?: string): boolean => {
    if (role !== 'guest') return true;
    loginSheet.open(undefined, { returnTo });
    return false;
  };
}
