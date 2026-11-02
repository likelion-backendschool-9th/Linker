'use client';

// overlay: featured-post selection preview; A's profile mutation remains unconnected
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { OverlayLink } from '@/components/overlay/overlay-link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import teamStyles from '@/features/teams/team-ui.module.css';
import { apiFetch } from '@/lib/api/api-fetch';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { PLAN_LIMITS } from '@/lib/policy';
import { profileHref } from '@/lib/navigation/collaboration-links';
import type { StatsSummary } from '../_lib/stats-queries';

export function StatsFeaturedSheet({
  login,
  posts,
  isPro,
}: {
  login: string | null;
  posts: StatsSummary['items'];
  isPro: boolean;
}) {
  const overlay = useOverlay('stats-featured');
  const profile = useQuery({
    queryKey: ['stats', login, 'featured-preview'],
    queryFn: ({ signal }) =>
      apiFetch<{ pinnedPostIds: number[] }>(`/api/v1/public/users/${encodeURIComponent(login!)}`, {
        signal,
      }),
    enabled: overlay.isOpen && !!login,
  });
  return (
    <OverlaySheet
      overlay={overlay}
      title="대표 작업물로 고정"
      description="프로필에 보여 줄 작업물을 선택해요. 선택 내용은 아직 저장되지 않아요."
    >
      {login && (
        <Button asChild variant="outline">
          <OverlayLink overlay={overlay} href={profileHref(login)}>
            내 프로필에서 확인
          </OverlayLink>
        </Button>
      )}
      {profile.isPending ? (
        <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
          <Skeleton />
        </LoadingIndicator>
      ) : profile.isError ? (
        <ErrorState onRetry={() => void profile.refetch()} />
      ) : (
        <FeaturedSelection
          key={`${overlay.isOpen}:${login}`}
          posts={posts}
          initial={profile.data.pinnedPostIds}
          limit={isPro ? PLAN_LIMITS.pinnedPosts.pro : PLAN_LIMITS.pinnedPosts.free}
          close={overlay.close}
        />
      )}
    </OverlaySheet>
  );
}

// client boundary: local selection is discarded on close, without changing profile data
function FeaturedSelection({
  posts,
  initial,
  limit,
  close,
}: {
  posts: StatsSummary['items'];
  initial: number[];
  limit: number;
  close: () => void;
}) {
  const [selected, setSelected] = useState(initial);
  return (
    <div className={teamStyles.section}>
      <p className={teamStyles.description}>
        대표 작업물 {selected.length}/{limit}개
      </p>
      <fieldset className={teamStyles.section}>
        <legend className={teamStyles.label}>고정할 작업물</legend>
        {posts.map((post) => (
          <label key={post.postId} className={teamStyles.choice}>
            <input
              type="checkbox"
              checked={selected.includes(post.postId)}
              disabled={!selected.includes(post.postId) && selected.length >= limit}
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...selected, post.postId]
                    : selected.filter((id) => id !== post.postId),
                )
              }
            />
            {post.intro}
          </label>
        ))}
      </fieldset>
      <p className={teamStyles.description}>프로필 저장 기능과 연결한 뒤 적용할 수 있어요.</p>
      <div className={teamStyles.actions}>
        <Button variant="outline" onClick={close}>
          취소
        </Button>
        <Button disabled>저장</Button>
      </div>
    </div>
  );
}
