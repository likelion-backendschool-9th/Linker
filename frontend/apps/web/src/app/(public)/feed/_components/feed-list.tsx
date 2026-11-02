'use client';

// Client boundary: virtualized infinite feed, seen logging, recruiter toggle, write button, ads
import { useInfiniteQuery } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { parseAsBoolean, useQueryState } from 'nuqs';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useRequireLogin } from '@/features/auth/use-require-login';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useViewer } from '@/lib/auth/viewer-context';

import { AdMenuSheet } from '../../_components/recruiter-ad-card/ad-menu-sheet';
import { RecruiterAdCard } from '../../_components/recruiter-ad-card/recruiter-ad-card';
import { feedOptions, sendSeen, type FeedItem } from '../_lib/feed-queries';
import styles from './feed-list.module.css';
import { PostCard } from './post-card';
import { RecommendedUsers } from './recommended-users';

const offersOnlyParser = parseAsBoolean.withDefault(false).withOptions({ history: 'replace' });
const itemKey = (item: FeedItem) =>
  item.type === 'AD' ? `ad-${item.adId}` : `post-${item.post.id}`;
const SEEN_FLUSH_MS = 1000;

/**
 * 24 Home feed (07 TODO 24). One list for every role: guests get popular + newest, members their
 * mix, recruiters a "제안 받는 개발자만" toggle; ads arrive only for logged-in developers (blueprint ch. 15).
 */
export function FeedList() {
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

  return (
    <>
      {recruiter && (
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={offersOnly}
            onClick={() => void setOffersOnly(!offersOnly)}
          >
            <span className={styles.switch} aria-hidden />
            제안 받는 개발자만
          </button>
        </div>
      )}

      {feed.isPending ? (
        <div aria-busy="true">
          <p role="status" className="sr-only">
            피드를 불러오고 있어요.
          </p>
          <Skeleton count={3} />
        </div>
      ) : feed.isError && !feed.data ? (
        <ErrorState onRetry={() => void feed.refetch()} />
      ) : items.length === 0 ? (
        <>
          <EmptyState
            title="아직 볼 글이 없어요."
            description={
              filter
                ? '제안을 받는 개발자의 새 글이 올라오면 여기에 보여요.'
                : '비슷한 스택의 개발자를 팔로우해 보세요.'
            }
          />
          {(viewer.role === 'developer' || viewer.role === 'operator') && <RecommendedUsers />}
        </>
      ) : (
        <VirtualFeed
          items={items}
          logSeen={viewer.role !== 'guest'}
          hasMore={feed.hasNextPage}
          loadingMore={feed.isFetchingNextPage}
          loadError={feed.isError}
          onLoadMore={() => void feed.fetchNextPage()}
          onRetry={() => void feed.refetch()}
          onAdDismissed={hideAd}
          onAdRestored={showAd}
        />
      )}

      {!recruiter && <WriteButton />}
      <AdMenuSheet onHidden={hideAd} />
    </>
  );
}

/** "게시물 쓰기" → 22; guests get the login prompt, recruiters have none (07 TODO 24) */
function WriteButton() {
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const label = (
    <>
      <Plus aria-hidden />
      게시물 쓰기
    </>
  );
  return (
    <div className={styles.write}>
      {viewer.role === 'guest' ? (
        <Button onClick={() => requireLogin('/posts/new')}>{label}</Button>
      ) : (
        <Button asChild>
          <Link href="/posts/new">{label}</Link>
        </Button>
      )}
    </div>
  );
}

type VirtualFeedProps = {
  items: FeedItem[];
  logSeen: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadError: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onAdDismissed: (adId: number) => void;
  onAdRestored: (adId: number) => void;
};

/** Cards in 1 → 2 → 3 lanes (guide ch. 3); a change of lanes remounts the virtualizer */
function VirtualFeed(props: VirtualFeedProps) {
  const tablet = useMediaQuery('(min-width: 600px)');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const lanes = desktop ? 3 : tablet ? 2 : 1;
  return <VirtualLanes key={lanes} lanes={lanes} {...props} />;
}

function VirtualLanes({
  lanes,
  items,
  logSeen,
  hasMore,
  loadingMore,
  loadError,
  onLoadMore,
  onRetry,
  onAdDismissed,
  onAdRestored,
}: VirtualFeedProps & { lanes: number }) {
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
    getItemKey: (index) => itemKey(items[index]!),
  });
  const rows = virtualizer.getVirtualItems();
  const lastIndex = rows.at(-1)?.index ?? -1;

  // Infinite scroll: the next page loads as the last cards come into view; "더 보기" stays for keyboards
  useEffect(() => {
    if (hasMore && !loadingMore && !loadError && lastIndex >= items.length - lanes * 2)
      onLoadMore();
  }, [hasMore, loadingMore, loadError, lastIndex, items.length, lanes, onLoadMore]);

  useSeenLogging(list, logSeen, rows.map((row) => row.key).join());

  return (
    <>
      <ul
        ref={list}
        aria-label="피드 게시물"
        className={styles.list}
        style={{ height: virtualizer.getTotalSize() }}
      >
        {rows.map((row) => {
          const item = items[row.index]!;
          return (
            <li
              key={row.key}
              ref={virtualizer.measureElement}
              data-index={row.index}
              aria-setsize={items.length}
              aria-posinset={row.index + 1}
              className={styles.row}
              style={{
                width: `calc((100% - ${lanes - 1} * var(--space-md)) / ${lanes})`,
                left: `calc(${row.lane} * ((100% - ${lanes - 1} * var(--space-md)) / ${lanes} + var(--space-md)))`,
                transform: `translateY(${row.start - scrollMargin}px)`,
              }}
            >
              {item.type === 'AD' ? (
                <RecruiterAdCard ad={item} onDismissed={onAdDismissed} onRestored={onAdRestored} />
              ) : (
                <PostCard post={item.post} whyShown={item.whyShown} />
              )}
            </li>
          );
        })}
      </ul>
      {loadError && <ErrorState title="피드를 더 불러오지 못했어요" onRetry={onRetry} />}
      {hasMore && (
        <Button variant="soft" block disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? '불러오는 중…' : '더 보기'}
        </Button>
      )}
    </>
  );
}

/**
 * Posts at least half on screen go to `POST /feed/seen` in batches so recommendations skip them.
 * Members only: guests' views are not recorded (07 TODO 24).
 */
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
