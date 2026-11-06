'use client';

import { useEffect, useRef } from 'react';

type InfiniteScrollTriggerOptions = {
  /** Load the next page while this is true (`hasNextPage && !isFetchingNextPage`) */
  enabled: boolean;
  onTrigger: () => void;
};

/**
 * Infinite scroll for lists that already end with a "더 보기" button (blueprint §6-5): attach the
 * returned ref to an element after the list, and the next page loads as it nears the viewport.
 * The button stays for keyboard and screen reader users.
 */
export function useInfiniteScrollTrigger<T extends Element>({
  enabled,
  onTrigger,
}: InfiniteScrollTriggerOptions) {
  const ref = useRef<T>(null);
  const trigger = useRef(onTrigger);

  useEffect(() => {
    trigger.current = onTrigger;
  });

  useEffect(() => {
    const target = ref.current;
    if (!enabled || !target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) trigger.current();
      },
      { rootMargin: '0px 0px 320px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}
