'use client';

// Overlay: people who liked the post; a people list, so login only (POL-A-9, POL-P-5)
import type { Route } from 'next';
import Image from 'next/image';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from '../post-detail/PostDetail.module.css';
import { useLikers, useLikersSheet } from './hook';

export function LikersSheet({ postId }: { postId: string }) {
  const overlay = useLikersSheet();
  return (
    <OverlaySheet
      overlay={overlay}
      title="좋아요한 사람"
      description="이 게시물을 좋아한 사람이에요."
      describeHidden
    >
      {overlay.isOpen && <Likers postId={postId} overlay={overlay} />}
    </OverlaySheet>
  );
}

function Likers({ postId, overlay }: { postId: string; overlay: OverlayControl }) {
  const likers = useLikers(postId);

  if (likers.isPending) return <Skeleton count={3} />;
  if (likers.isError) return <ErrorState onRetry={() => void likers.refetch()} />;
  if (likers.data.items.length === 0) return <EmptyState title="아직 좋아요가 없어요." />;

  return (
    <ul className={styles.people}>
      {likers.data.items.map(({ user }) => (
        <li key={user.id}>
          {/* Leaving from inside the sheet: close first, then navigate (blueprint §7-2) */}
          <button
            type="button"
            className={styles.person}
            onClick={() => void overlay.closeThen(`/user/${user.login}` as Route)}
          >
            <Image
              src={user.avatarUrl}
              alt=""
              width={40}
              height={40}
              sizes="40px"
              className={styles.personAvatar}
            />
            <span className={styles.personText}>
              <span className={styles.personName}>{user.name}</span>
              <span className={styles.personLogin}>@{user.login}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
