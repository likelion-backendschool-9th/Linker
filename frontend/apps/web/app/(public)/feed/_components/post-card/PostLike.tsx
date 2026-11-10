'use client';

import { HeartBoldIcon } from '@solar-icons/static/bold/heart';
import { HeartOutlineIcon } from '@solar-icons/static/outline/heart';

import { Icon } from '@/components/ui/icon';

import type { FeedPost } from '../../_lib/feed-queries';
import styles from './PostCard.module.css';
import { usePostLike } from './hook';

/** Like + count — Figma 92:226: heart outline #3c3c3c, liked = heart-bold #ff3040 (92:297) */
export function PostLike({ post }: { post: FeedPost }) {
  const { canLike, toggle } = usePostLike(post);
  const liked = post.likedByMe === true;
  const heart = liked ? (
    <Icon svg={HeartBoldIcon} className={styles.likedIcon} />
  ) : (
    <Icon svg={HeartOutlineIcon} className={styles.statIcon} />
  );

  return (
    <span className={styles.stat}>
      {canLike ? (
        <button type="button" className={styles.likeButton} aria-pressed={liked} onClick={toggle}>
          {heart}
          <span className="sr-only">좋아요</span>
        </button>
      ) : (
        heart
      )}
      <span className={styles.statCount}>
        <span className="sr-only">좋아요 </span>
        {post.likeCount.toLocaleString('ko-KR')}
      </span>
    </span>
  );
}
