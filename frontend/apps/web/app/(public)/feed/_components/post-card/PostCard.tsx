import { ChatRoundLinearIcon } from '@solar-icons/static/linear/chat-round';
import { HeartOutlineIcon } from '@solar-icons/static/outline/heart';
import { Plane3OutlineIcon } from '@solar-icons/static/outline/plane-3';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Icon } from '@/components/ui/icon';
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';

import type { FeedPost } from '../../_lib/feed-queries';
import styles from './PostCard.module.css';

type PostCardProps = {
  post: FeedPost;
  /** Recommendation reason — kept for API/a11y; not in Figma 91:105 card chrome */
  whyShown: string | null;
  /** Traffic source stored when the detail page is opened (page 23). */
  from?: 'feed' | 'profile';
  /** Profile sections already use h2, so their cards drop to h3. */
  titleLevel?: 2 | 3;
};

/**
 * Feed card (Figma 92:249). Markup only: like / comment / share are static counts — no toggle,
 * comment panel, or share sheet yet.
 */
export function PostCard({ post, whyShown, from = 'feed', titleLevel = 2 }: PostCardProps) {
  const titleId = `feed-post-${post.id}-title`;
  const repoName = post.repoFullName.split('/')[1] ?? post.repoFullName;
  const Title = titleLevel === 3 ? 'h3' : 'h2';
  const detailHref = `/posts/${post.id}?from=${from}` as Route;
  const seeking = post.author.jobStatus === 'SEEKING';

  return (
    <article aria-labelledby={titleId} className={styles.card} data-post-id={post.id}>
      {whyShown && <p className="sr-only">{whyShown}</p>}

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
              {seeking && <span className={styles.seeking}>구직 중</span>}
              <span className={styles.login}>{post.author.login}</span>
            </span>
          </Link>
          {/* Visual only for now — follow mutation not wired on the feed card */}
          <button type="button" className={styles.follow}>
            팔로우
          </button>
        </div>

        <Link href={detailHref} className={styles.cover} tabIndex={-1} aria-hidden>
          {post.coverUrl ? (
            <Image
              src={post.coverUrl}
              alt=""
              fill
              sizes="(min-width: 600px) 568px, 100vw"
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

      <div className={styles.meta}>
        {/* Figma 92:225: groups gap 10, icon↔count gap 4, icons 20, stroke 1.5 */}
        <div className={styles.reactions}>
          <span className={styles.stat}>
            <Icon svg={HeartOutlineIcon} className={styles.statIcon} />
            <span className={styles.statCount}>
              <span className="sr-only">좋아요 </span>
              {post.likeCount.toLocaleString('ko-KR')}
            </span>
          </span>
          <span className={styles.stat}>
            <Icon svg={ChatRoundLinearIcon} className={styles.statIcon} />
            <span className={styles.statCount}>
              <span className="sr-only">댓글 </span>
              {post.commentCount.toLocaleString('ko-KR')}
            </span>
          </span>
          <span className={styles.stat}>
            <Icon svg={Plane3OutlineIcon} className={styles.statIcon} />
            <span className="sr-only">공유</span>
          </span>
        </div>
        <span className={styles.time}>
          <RelativeTime value={post.createdAt} />
        </span>
      </div>

      <div className={styles.copy}>
        <Title id={titleId} className={styles.title}>
          <Link href={detailHref} className={styles.titleLink}>
            {post.intro}
          </Link>
        </Title>
        {post.excerpt && (
          <p className={styles.excerpt}>
            <span className={styles.excerptText}>{post.excerpt}</span>{' '}
            <Link href={detailHref} className={styles.more}>
              더 보기
            </Link>
          </p>
        )}
      </div>
    </article>
  );
}
