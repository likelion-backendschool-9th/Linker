'use client';

import type { FeedPost } from '../../_lib/feed-queries';
import styles from './PostCard.module.css';
import { usePostFollow } from './hook';

/**
 * "팔로우" (Figma 92:214) / "팔로잉" (92:259). Guests see "팔로우" and get the login prompt on press
 * (04 ch. 2); recruiters can't follow and nobody follows themselves, so neither gets the chip.
 */
export function PostFollow({ post }: { post: FeedPost }) {
  const follow = usePostFollow(post);
  if (!follow.visible) return null;

  return (
    <button
      type="button"
      className={follow.following ? styles.following : styles.follow}
      aria-pressed={follow.following}
      aria-disabled={follow.pending || undefined}
      onClick={follow.toggle}
    >
      {follow.following ? '팔로잉' : '팔로우'}
    </button>
  );
}
