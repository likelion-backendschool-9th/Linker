'use client';

// overlay: featured-post selection preview; A's profile mutation remains unconnected
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { OverlayLink } from '@/components/overlay/overlay-link/OverlayLink';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import teamStyles from '@/features/teams/team-ui.module.css';
import { profileHref } from '@/lib/navigation/collaboration-links';

import {
  useFeaturedSelection,
  useStatsFeaturedSheet,
  type FeaturedPosts,
} from './hook';

export function StatsFeaturedSheet({
  login,
  posts,
  isPro,
}: {
  login: string | null;
  posts: FeaturedPosts;
  isPro: boolean;
}) {
  const { overlay, profile, limit } = useStatsFeaturedSheet({ login, isPro });
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
        <Skeleton />
      ) : profile.isError ? (
        <ErrorState onRetry={() => void profile.refetch()} />
      ) : (
        <FeaturedSelection
          key={`${overlay.isOpen}:${login}`}
          posts={posts}
          initial={profile.data.pinnedPostIds}
          limit={limit}
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
  posts: FeaturedPosts;
  initial: number[];
  limit: number;
  close: () => void;
}) {
  const { selected, toggle } = useFeaturedSelection(initial);
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
              onChange={(event) => toggle(post.postId, event.target.checked, limit)}
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
