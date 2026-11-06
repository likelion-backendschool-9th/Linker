'use client';

import { useQuery } from '@tanstack/react-query';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { likersOptions } from '../../_lib/post-detail-queries';

export function useLikersSheet() {
  return useOverlay('post-likers');
}

export function useLikers(postId: string) {
  const viewer = useViewer();
  return useQuery(likersOptions(viewer.login, postId));
}
