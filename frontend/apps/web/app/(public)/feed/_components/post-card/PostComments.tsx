'use client';

import { ChatRoundLinearIcon } from '@solar-icons/static/linear/chat-round';
import { useQueryClient } from '@tanstack/react-query';

import { Icon } from '@/components/ui/icon';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { commentsOptions } from './api';
import styles from './PostCard.module.css';

/**
 * Comment icon + count — Figma 92:230. On the feed it opens the comment sheet (374:3944, mounted
 * once by FeedList); elsewhere (04 profile posts) it stays a plain count.
 */
export function PostComments({
  postId,
  count,
  sheet,
}: {
  postId: number;
  count: number;
  sheet: boolean;
}) {
  const comments = useOverlay('feed-comments');
  const client = useQueryClient();
  // Start loading on press, so the sheet usually opens with its comments already there
  const prefetch = () => void client.prefetchQuery(commentsOptions(String(postId)));
  const content = (
    <>
      <Icon svg={ChatRoundLinearIcon} className={styles.statIcon} />
      <span className={styles.statCount}>
        <span className="sr-only">댓글 </span>
        {count.toLocaleString('ko-KR')}
      </span>
    </>
  );

  if (!sheet) return <span className={styles.stat}>{content}</span>;
  return (
    <button
      type="button"
      className={`${styles.stat} ${styles.statButton}`}
      aria-haspopup="dialog"
      onPointerDown={prefetch}
      onFocus={prefetch}
      onClick={() => comments.open(String(postId))}
    >
      {content}
      <span className="sr-only"> 보기</span>
    </button>
  );
}
