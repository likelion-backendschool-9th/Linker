import { Heart, MessageCircle, Sparkles } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import type { FeedPost } from '../../_lib/feed-queries';
import styles from './PostCard.module.css';

type PostCardProps = {
  post: FeedPost;
  /** One line, the highest-priority reason (04 ch. 4 "Why shown") */
  whyShown: string | null;
};

/**
 * Feed card (07 TODO 24): cover (or the repo card), author with the "구직 중" badge, intro, counts.
 * The title link stretches over the whole card and opens 23.
 */
export function PostCard({ post, whyShown }: PostCardProps) {
  const titleId = `feed-post-${post.id}-title`;
  const repoName = post.repoFullName.split('/')[1] ?? post.repoFullName;

  return (
    <article aria-labelledby={titleId} className={styles.card} data-post-id={post.id}>
      {whyShown && (
        <p className={styles.why}>
          <Sparkles aria-hidden className={styles.icon} />
          {whyShown}
        </p>
      )}
      <div className={styles.cover}>
        {post.coverUrl ? (
          <Image
            src={post.coverUrl}
            alt={`${repoName} 이미지`}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 600px) 50vw, 100vw"
            className={styles.image}
          />
        ) : (
          // No photos: the repo card stands in for the cover (07 TODO 24)
          <div className={styles.repoCover}>
            <span className={styles.repoName}>{post.repoFullName}</span>
            {post.language && <span className={styles.repoLanguage}>{post.language}</span>}
          </div>
        )}
      </div>
      <h2 id={titleId} className={styles.title}>
        <Link href={`/posts/${post.id}?from=feed` as Route} className={styles.link}>
          {post.intro}
        </Link>
      </h2>
      <div className={styles.foot}>
        <p className={styles.author}>
          <Image
            src={post.author.avatarUrl}
            alt=""
            width={24}
            height={24}
            sizes="24px"
            className={styles.avatar}
          />
          <span className={styles.name}>{post.author.name}</span>
          {post.author.jobStatus === 'SEEKING' && <span className={styles.seeking}>구직 중</span>}
        </p>
        <p className={styles.counts}>
          <span className={styles.count}>
            <Heart aria-hidden className={styles.icon} />
            <span className="sr-only">좋아요 </span>
            {post.likeCount}
          </span>
          <span className={styles.count}>
            <MessageCircle aria-hidden className={styles.icon} />
            <span className="sr-only">댓글 </span>
            {post.commentCount}
          </span>
        </p>
      </div>
    </article>
  );
}
