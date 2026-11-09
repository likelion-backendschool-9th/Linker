'use client';

import { useQuery } from '@tanstack/react-query';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { editorReposOptions } from '../repo-step/api';

/** Same repo list as step 1 (no search), read only while the sheet is open */
export function useRepoChangeSheet(teamId: string | null) {
  const viewer = useViewer();
  const overlay = useOverlay('post-repo');
  const repos = useQuery({
    ...editorReposOptions(viewer.login, '', teamId),
    enabled: overlay.isOpen,
  });
  return { overlay, repos };
}
