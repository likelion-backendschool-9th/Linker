'use client';

import { Plane3OutlineIcon } from '@solar-icons/static/outline/plane-3';
import { useQueryClient } from '@tanstack/react-query';

import { Icon } from '@/components/ui/icon';
import { useRequireLogin } from '@/features/auth/use-require-login';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { shareRoomsOptions } from './api';
import styles from './PostCard.module.css';

/**
 * Paper-plane icon — Figma 92:244. On the feed it opens the share drawer (780:584, mounted once by
 * FeedList); guests get the login prompt first (04 POL-P-7). Elsewhere it stays a plain icon.
 */
export function PostShare({ postId, drawer }: { postId: number; drawer: boolean }) {
  const share = useOverlay('feed-share');
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const client = useQueryClient();
  const icon = <Icon svg={Plane3OutlineIcon} className={styles.statIcon} />;

  if (!drawer) {
    return (
      <span className={styles.stat}>
        {icon}
        <span className="sr-only">공유</span>
      </span>
    );
  }
  // Start loading my rooms on press, so the drawer usually opens with its list already there
  const prefetch = () => {
    if (viewer.role !== 'guest') void client.prefetchQuery(shareRoomsOptions(viewer.login, ''));
  };
  return (
    <button
      type="button"
      className={`${styles.stat} ${styles.statButton}`}
      aria-haspopup="dialog"
      onPointerDown={prefetch}
      onFocus={prefetch}
      onClick={() => {
        if (requireLogin()) share.open(String(postId));
      }}
    >
      {icon}
      <span className="sr-only">채팅방에 공유</span>
    </button>
  );
}
