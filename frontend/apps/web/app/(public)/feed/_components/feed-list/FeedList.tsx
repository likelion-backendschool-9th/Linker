'use client';

// Client boundary: virtualized infinite feed, seen logging, recruiter toggle, write button, ads
import { Plus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import { AdMenuSheet } from '../../../_components/recruiter-ad-card/ad-menu-sheet';
import { RecruiterAdCard } from '../../../_components/recruiter-ad-card';
import type { FeedItem } from '../../_lib/feed-queries';
import styles from './FeedList.module.css';
import { useFeedList, useVirtualFeedLanes, useVirtualLanes, useWriteButton } from './hook';
import { PostCard } from '../post-card';
import { RecommendedUsers } from '../recommended-users';

/**
 * 24 Home feed (07 TODO 24). One list for every role: guests get popular + newest, members their
 * mix, recruiters a "제안 받는 개발자만" toggle; ads arrive only for logged-in developers (blueprint ch. 15).
 */
export function FeedList() {
  const {
    viewer,
    recruiter,
    offersOnly,
    toggleOffersOnly,
    filter,
    feed,
    items,
    hideAd,
    showAd,
  } = useFeedList();

  return (
    <>
      {recruiter && (
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={offersOnly}
            onClick={toggleOffersOnly}
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
  const { isGuest, promptLogin } = useWriteButton();
  const label = (
    <>
      <Plus aria-hidden />
      게시물 쓰기
    </>
  );
  return (
    <div className={styles.write}>
      {isGuest ? (
        <Button onClick={promptLogin}>{label}</Button>
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
  const lanes = useVirtualFeedLanes();
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
  const { list, scrollMargin, virtualizer, rows } = useVirtualLanes({
    lanes,
    items,
    logSeen,
    hasMore,
    loadingMore,
    loadError,
    onLoadMore,
  });

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
