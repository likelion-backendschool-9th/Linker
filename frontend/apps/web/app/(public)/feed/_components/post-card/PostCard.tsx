import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';

import type { FeedPost } from '../../_lib/feed-queries';
import styles from './PostCard.module.css';
import { PostComments } from './PostComments';
import { PostExcerpt } from './PostExcerpt';
import { PostFollow } from './PostFollow';
import { PostLike } from './PostLike';
import { PostShare } from './PostShare';

type PostCardProps = {
  post: FeedPost;
  /** Recommendation reason — kept for API/a11y; not in Figma 91:105 card chrome */
  whyShown: string | null;
  /** Traffic source stored when the detail page is opened (page 23). */
  from?: 'feed' | 'profile';
  /** Profile sections already use h2, so their cards drop to h3. */
  titleLevel?: 2 | 3;
  /** Feed only: the comment and share icons open the sheet / drawer that FeedList mounts */
  feedOverlays?: boolean;
};

/** Job status above the login (Figma 785:778), shown for all three states: 구직 중 blue, 제안 받기 accent, 구직 안 함 gray */
const JOB_STATUS = {
  SEEKING: { label: '구직 중', tone: 'seeking' },
  OPEN: { label: '제안 받기', tone: 'open' },
  OFF: { label: '구직 안 함', tone: 'off' },
} as const satisfies Record<FeedPost['author']['jobStatus'], { label: string; tone: string }>;

/**
 * Feed card (Figma 92:249). The heart toggles a like (optimistic); on the feed the comment icon opens
 * the comment sheet and the paper plane the share drawer. Guests get the login prompt on follow, like,
 * comment send and share; follow itself only shows state for now.
 */
export function PostCard({
  post,
  whyShown,
  from = 'feed',
  titleLevel = 2,
  feedOverlays = false,
}: PostCardProps) {
  const titleId = `feed-post-${post.id}-title`;
  const Title = titleLevel === 3 ? 'h3' : 'h2';
  const detailHref = `/posts/${post.id}?from=${from}` as Route;
  const jobStatus = JOB_STATUS[post.author.jobStatus];

  return (
    <article aria-labelledby={titleId} className={styles.card} data-post-id={post.id}>
      {whyShown && <p className="sr-only">{whyShown}</p>}

      {/* Author + cover shell — Figma 92:181 */}
      <div className={styles.shell}>
        <div className={styles.authorRow}>
          <Link href={`/user/${post.author.login}` as Route} className={styles.author}>
            <Image
              src={post.author.avatarUrl}
              alt=""
              width={42}
              height={42}
              sizes="42px"
              className={styles.avatar}
            />
            <span className={styles.authorText}>
              {jobStatus && <span className={styles[jobStatus.tone]}>{jobStatus.label}</span>}
              <span className={styles.login}>{post.author.login}</span>
            </span>
          </Link>
          <PostFollow post={post} />
        </div>

        <Link href={detailHref} className={styles.cover} tabIndex={-1} aria-hidden>
          {post.coverUrl ? (
            <Image
              src={post.coverUrl}
              alt=""
              fill
              sizes="(min-width: 600px) 536px, calc(100vw - 64px)"
              className={styles.image}
            />
          ) : (
            <span className={styles.repoCover}>
              <span className={styles.repoName}>{post.repoFullName}</span>
              {post.language && <span className={styles.repoLanguage}>{post.language}</span>}
            </span>
          )}
        </Link>
      </div>

      {/* Reactions + time — Figma 92:248 */}
      <div className={styles.meta}>
        <div className={styles.reactions}>
          <PostLike post={post} />
          <PostComments postId={post.id} count={post.commentCount} sheet={feedOverlays} />
          <PostShare postId={post.id} drawer={feedOverlays} />
        </div>
        <span className={styles.time}>
          <RelativeTime value={post.createdAt} />
        </span>
      </div>

      {/* Title + excerpt — Figma 92:219 */}
      <div className={styles.copy}>
        <Title id={titleId} className={styles.title}>
          <Link href={detailHref} className={styles.titleLink}>
            {post.intro}
          </Link>
        </Title>
        {post.excerpt && <PostExcerpt text={post.excerpt} href={detailHref} />}
      </div>
    </article>
  );
}
