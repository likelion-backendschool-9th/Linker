'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { parseAsBoolean, useQueryState } from 'nuqs';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useViewer } from '@/lib/auth/viewer-context';

import { feedOptions, sendSeen, type FeedItem } from '../../_lib/feed-queries';

const offersOnlyParser = parseAsBoolean.withDefault(false).withOptions({ history: 'replace' });
export const feedItemKey = (item: FeedItem) =>
  item.type === 'AD' ? `ad-${item.adId}` : `post-${item.post.id}`;
const SEEN_FLUSH_MS = 1000;

export function useFeedList() {
  const viewer = useViewer();
  const recruiter = viewer.role === 'recruiter';
  const [offersOnly, setOffersOnly] = useQueryState('offersOnly', offersOnlyParser);
  const filter = recruiter && offersOnly;
  const feed = useInfiniteQuery(feedOptions(viewer.login, filter));
  const [hiddenAds, setHiddenAds] = useState<ReadonlySet<number>>(new Set());
  const items = (feed.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (item) => item.type !== 'AD' || !hiddenAds.has(item.adId),
  );
  const hideAd = (adId: number) => setHiddenAds((current) => new Set(current).add(adId));
  const showAd = (adId: number) =>
    setHiddenAds((current) => {
      const next = new Set(current);
      next.delete(adId);
      return next;
    });

  return {
    viewer,
    recruiter,
    offersOnly,
    toggleOffersOnly: () => void setOffersOnly(!offersOnly),
    filter,
    feed,
    items,
    hideAd,
    showAd,
  };
}

export function useWriteButton() {
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  return {
    isGuest: viewer.role === 'guest',
    promptLogin: () => requireLogin('/posts/new'),
  };
}

export function useVirtualFeedLanes() {
  const tablet = useMediaQuery('(min-width: 600px)');
  const desktop = useMediaQuery('(min-width: 1024px)');
  return desktop ? 3 : tablet ? 2 : 1;
}

type UseVirtualLanesArgs = {
  lanes: number;
  items: FeedItem[];
  logSeen: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadError: boolean;
  onLoadMore: () => void;
};

export function useVirtualLanes({
  lanes,
  items,
  logSeen,
  hasMore,
  loadingMore,
  loadError,
  onLoadMore,
}: UseVirtualLanesArgs) {
  'use no memo';
  const list = useRef<HTMLUListElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const element = list.current;
    if (element) setScrollMargin(element.getBoundingClientRect().top + window.scrollY);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    lanes,
    estimateSize: () => 440,
    overscan: 6,
    scrollMargin,
    // The server renders the first screen too (24 is indexed); same rect on the client's first pass
    initialRect: { width: 0, height: 1200 },
    getItemKey: (index) => feedItemKey(items[index]!),
  });
  const rows = virtualizer.getVirtualItems();
  const lastIndex = rows.at(-1)?.index ?? -1;

  useEffect(() => {
    if (hasMore && !loadingMore && !loadError && lastIndex >= items.length - lanes * 2)
      onLoadMore();
  }, [hasMore, loadingMore, loadError, lastIndex, items.length, lanes, onLoadMore]);

  useSeenLogging(list, logSeen, rows.map((row) => row.key).join());

  return { list, scrollMargin, virtualizer, rows };
}

function useSeenLogging(
  list: React.RefObject<HTMLUListElement | null>,
  enabled: boolean,
  renderedKeys: string,
) {
  const sent = useRef(new Set<number>());
  const pending = useRef(new Set<number>());
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const root = list.current;
    if (!enabled || !root || typeof IntersectionObserver === 'undefined') return;
    const flush = () => {
      timer.current = null;
      const ids = [...pending.current];
      pending.current.clear();
      ids.forEach((id) => sent.current.add(id));
      // Best effort: a lost batch only means a post may be recommended again
      if (ids.length) sendSeen(ids).catch(() => undefined);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = Number((entry.target as HTMLElement).dataset.postId);
          if (!entry.isIntersecting || !id || sent.current.has(id)) continue;
          pending.current.add(id);
        }
        if (pending.current.size && timer.current === null)
          timer.current = window.setTimeout(flush, SEEN_FLUSH_MS);
      },
      { threshold: 0.5 },
    );
    root.querySelectorAll<HTMLElement>('[data-post-id]').forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [list, enabled, renderedKeys]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
}
