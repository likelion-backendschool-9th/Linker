'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useViewer } from '@/lib/auth/viewer-context';
import { toast } from '@/stores/toast-store';

import { recommendedUsersOptions, setFollow, type RecommendedUser } from '../../_lib/feed-queries';

export function useRecommendedUsers() {
  const viewer = useViewer();
  return useQuery(recommendedUsersOptions(viewer.login));
}

/** Follow is applied on screen first and reverted on failure (04 ch. 2) */
export function useRecommendedPerson(item: RecommendedUser) {
  const [following, setFollowing] = useState(false);
  const follow = useMutation({
    mutationFn: (next: boolean) => setFollow(item.user.login, next),
    onMutate: (next) => setFollowing(next),
    onError: (_error, next) => {
      setFollowing(!next);
      toast('팔로우를 반영하지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'alert' });
    },
  });

  return {
    following,
    followPending: follow.isPending,
    toggleFollow: () => follow.mutate(!following),
  };
}
