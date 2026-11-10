'use client';

import { useQuery } from '@tanstack/react-query';

import { useViewer } from '@/lib/auth/viewer-context';

import { sameRepoPostsOptions } from './api';

export function useSameRepoPosts(postId: string) {
  const viewer = useViewer();
  const posts = useQuery(sameRepoPostsOptions(viewer.login, postId));
  return { items: posts.data?.items ?? [] };
}
