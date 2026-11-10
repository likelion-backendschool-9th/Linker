'use client';

// Client boundary: virtualized infinite feed, seen logging, recruiter toggle, write FAB, ads
import { PenLinearIcon } from '@solar-icons/static/linear/pen';
import Link from 'next/link';
import { useId } from 'react';

import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import { AdMenuSheet } from '../../../_components/recruiter-ad-card/ad-menu-sheet';
import { RecruiterAdCard } from '../../../_components/recruiter-ad-card';
import { TabChromeCollapseEffect } from '../../../_components/tab-chrome-collapse';
import type { FeedItem } from '../../_lib/feed-queries';
import styles from './FeedList.module.css';
import { useFeedList, useVirtualFeedLanes, useVirtualLanes, useWriteButton } from './hook';
import { CommentSheet } from '../comment-sheet';
import { FeedTabs, feedPanelId, feedTabId } from '../feed-tabs';
import { ShareDrawer } from '../share-drawer';
import { PostCard } from '../post-card';
import { RecommendedUsers } from '../recommended-users';

/**
 * 24 Home feed (07 TODO 24, Figma 785:770). "추천" for every role: guests get popular + newest,
 * members their mix, recruiters a "제안 받는 개발자만" toggle; ads arrive only for logged-in developers
 * (blueprint ch. 15). "팔로잉": posts by people I follow; guests get a login notice. The tabs pin to
 * the top and the header hides on scroll, same as 19.
 */
export function FeedList() {
  const idBase = useId();
  const {
    viewer,
    recruiter,
    tab,
    tabs,
    setTab,
    following,
    loginNeeded,
    promptLogin,
    offersOnly,
    toggleOffersOnly,
    filter,
    feed,
    items,
    hideAd,
    showAd,
  } = useFeedList();

  return (
    <div className={styles.feed}>
      <TabChromeCollapseEffect />
      {/* Slot keeps in-flow height while the tabs pin to the viewport top when collapsed */}
      <div className={styles.chromeSlot}>
        <div className={styles.chromeSticky} data-tab-chrome>
          <FeedTabs idBase={idBase} current={tab} onChange={setTab} available={tabs} />
        </div>
      </div>

      <div
        role="tabpanel"
        id={feedPanelId(idBase)}
        aria-labelledby={feedTabId(idBase, tab)}
        className={styles.panel}
      >
        {loginNeeded ? (
          <EmptyState
            title="로그인하지 않으면 팔로잉 피드를 불러올 수 없어요."
            action={<Button onClick={promptLogin}>로그인 하러 가기</Button>}
          />
        ) : (
          <FeedBody
            key={tab}
            viewer={viewer}
            recruiter={recruiter}
            following={following}
            offersOnly={offersOnly}
            toggleOffersOnly={toggleOffersOnly}
            filter={filter}
            feed={feed}
            items={items}
            hideAd={hideAd}
            showAd={showAd}
          />
        )}
      </div>

      {!recruiter && <WriteButton />}
      <AdMenuSheet onHidden={hideAd} />
      <CommentSheet />
      <ShareDrawer />
    </div>
  );
}

type FeedState = ReturnType<typeof useFeedList>;

/** One tab's list; keyed by tab so the virtualizer starts fresh on a switch */
function FeedBody({
  viewer,
  recruiter,
  following,
  offersOnly,
  toggleOffersOnly,
  filter,
  feed,
  items,
  hideAd,
  showAd,
}: Pick<
  FeedState,
  | 'viewer'
  | 'recruiter'
  | 'following'
  | 'offersOnly'
  | 'toggleOffersOnly'
  | 'filter'
  | 'feed'
  | 'items'
  | 'hideAd'
  | 'showAd'
>) {
  return (
    <>
      {recruiter && !following && (
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
        following ? (
          <EmptyState title="팔로잉한 사용자가 없습니다." />
        ) : (
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
        )
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
    </>
  );
}

/** Write FAB (Figma 92:289) → 22; guests get the login prompt, recruiters have none */
function WriteButton() {
  const { isGuest, promptLogin } = useWriteButton();
  const visual = (
    <span className={styles.fabVisual}>
      <Icon svg={PenLinearIcon} className={styles.fabIcon} />
    </span>
  );
  return (
    <div className={styles.fabLayer}>
      {isGuest ? (
        <button type="button" className={styles.fab} aria-label="게시물 쓰기" onClick={promptLogin}>
          {visual}
        </button>
      ) : (
        <Link href="/posts/new" className={styles.fab} aria-label="게시물 쓰기">
          {visual}
        </Link>
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
                <PostCard post={item.post} whyShown={item.whyShown} feedOverlays />
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
