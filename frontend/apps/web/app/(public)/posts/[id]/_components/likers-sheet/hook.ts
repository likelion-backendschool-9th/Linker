'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { likersOptions } from '../../_lib/post-detail-queries';

export function useLikersSheet() {
  return useOverlay('post-likers');
}

/** 20 people per page; the next page loads when the end of the list scrolls into view */
export function useLikers(postId: string) {
  const viewer = useViewer();
  const likers = useInfiniteQuery(likersOptions(viewer.login, postId));
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = likers;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    likers,
    items: likers.data?.pages.flatMap((page) => page.items) ?? [],
    sentinel,
  };
}
