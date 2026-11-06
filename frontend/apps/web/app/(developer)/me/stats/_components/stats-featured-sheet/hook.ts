'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { PLAN_LIMITS } from '@/lib/policy';

import type { StatsSummary } from '../../_lib/stats-queries';
import { fetchPinnedPostIds } from './api';

export function useStatsFeaturedSheet({
  login,
  isPro,
}: {
  login: string | null;
  isPro: boolean;
}) {
  const overlay = useOverlay('stats-featured');
  const profile = useQuery({
    queryKey: ['stats', login, 'featured-preview'],
    queryFn: ({ signal }) => fetchPinnedPostIds(login!, signal),
    enabled: overlay.isOpen && !!login,
  });

  return {
    overlay,
    profile,
    limit: isPro ? PLAN_LIMITS.pinnedPosts.pro : PLAN_LIMITS.pinnedPosts.free,
  };
}

export function useFeaturedSelection(initial: number[]) {
  const [selected, setSelected] = useState(initial);

  function toggle(postId: number, checked: boolean, limit: number) {
    setSelected((current) => {
      if (checked) {
        if (current.includes(postId) || current.length >= limit) return current;
        return [...current, postId];
      }
      return current.filter((id) => id !== postId);
    });
  }

  return { selected, toggle };
}

export type FeaturedPosts = StatsSummary['items'];
