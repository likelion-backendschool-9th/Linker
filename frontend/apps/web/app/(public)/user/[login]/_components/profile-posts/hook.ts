'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchProfilePosts } from './api';

export function useProfilePosts(login: string) {
  return useQuery({
    queryKey: ['profile-posts', login],
    queryFn: () => fetchProfilePosts(login),
  });
}
