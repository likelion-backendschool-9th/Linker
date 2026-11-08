'use client';

import { useOverlay } from '@/lib/navigation/use-overlay';

export function useMyIssuesTeamOverlay() {
  return useOverlay('my-issues-team');
}
