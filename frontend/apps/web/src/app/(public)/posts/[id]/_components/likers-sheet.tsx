'use client';

// Overlay: people who liked the post; a people list, so login only (POL-A-9, POL-P-5)
import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Image from 'next/image';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';

import { likersOptions } from '../_lib/post-detail-queries';
import styles from './post-detail.module.css';

export function LikersSheet({ postId }: { postId: string }) {
  const overlay = useOverlay('post-likers');
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
  const viewer = useViewer();
  const likers = useQuery(likersOptions(viewer.login, postId));

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
