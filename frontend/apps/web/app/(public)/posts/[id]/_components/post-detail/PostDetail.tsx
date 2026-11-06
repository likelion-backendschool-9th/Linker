'use client';

// Client boundary: viewer-dependent actions (like, comment, menus), optimistic like, sheets
import { ExternalLink, GitFork, Heart, MessageCircle, MoreHorizontal, Star } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { useOpenExternal } from '@/features/external-link/use-open-external';

import { linkify } from '../../_lib/linkify';
import type { PostDetail as Detail } from '../../_lib/post-detail-queries';
import { CommentSection } from '../comment-section';
import { LikersSheet } from '../likers-sheet';
import { PhotoCarousel } from '../photo-carousel';
import styles from './PostDetail.module.css';
import { useAuthorRow, usePostDetail, useReactionBar, useSameRepoPosts } from './hook';
import { PostMenuSheet } from '../post-menu-sheet';
import { ReadmeSection } from '../readme-section';

/** `yyyy-MM` → "2026년 10월" */
const monthLabel = (value: string) => {
  const [year, month] = value.split('-');
  return `${year}년 ${Number(month)}월`;
};

/**
 * 23 Project post detail (07 TODO 23). Guests read everything but like / comment / more ask them
 * to log in; recruiters read lists without the like button and comment input (04 ch. 2).
 */
export function PostDetail({ postId }: { postId: string }) {
  const { detail, post, underReview, canReact } = usePostDetail(postId);

  if (detail.isPending) {
    return (
      <div aria-busy="true">
        <p role="status">게시물을 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    );
  }
  if (detail.isError || !post) return <ErrorState onRetry={() => void detail.refetch()} />;

  return (
    <>
      {underReview && (
        <p className={styles.review} role="status">
          <strong>검토 중</strong> 신고가 들어와 검토하고 있어요. 검토가 끝날 때까지 다른 사람에게는
          보이지 않아요.
        </p>
      )}

      <div className={styles.layout}>
        <article aria-labelledby="post-intro" className={styles.main}>
          <AuthorRow post={post} />
          <h2 id="post-intro" className={styles.intro}>
            {post.intro}
          </h2>
          {post.photos.length > 0 && (
            <PhotoCarousel photos={post.photos} repoName={post.repo.fullName.split('/')[1] ?? ''} />
          )}
          <ReactionBar post={post} canReact={canReact} />
          {post.body && <PostBody text={post.body} />}
          <PostFields post={post} />
          <CommentSection post={post} canWrite={canReact} />
        </article>

        <aside aria-label="레포와 관련 게시물" className={styles.aside}>
          <RepoCard post={post} />
          <SameRepoPosts postId={postId} />
        </aside>
      </div>

      <PostMenuSheet post={post} />
      <LikersSheet postId={postId} />
    </>
  );
}

function AuthorRow({ post }: { post: Detail }) {
  const { openMenu } = useAuthorRow();
  return (
    <div className={styles.authorRow}>
      <Link href={`/users/${post.author.login}` as Route} className={styles.author}>
        <Image
          src={post.author.avatarUrl}
          alt=""
          width={40}
          height={40}
          sizes="40px"
          className={styles.authorAvatar}
        />
        <span className={styles.authorText}>
          <span className={styles.authorName}>
            {post.author.name}
            {/* Only "구직 중" is public (POL-H-4) */}
            {post.author.jobStatus === 'SEEKING' && <span className={styles.seeking}>구직 중</span>}
          </span>
          <span className={styles.meta}>
            <RelativeTime value={post.createdAt} />
            {post.editedAt && ' · 수정됨'}
          </span>
        </span>
      </Link>
      <button type="button" className={styles.iconButton} onClick={openMenu}>
        <MoreHorizontal aria-hidden />
        <span className="sr-only">게시물 더보기</span>
      </button>
    </div>
  );
}

/** Like applied on screen first and reverted on failure (04 ch. 2 "Network and failures") */
function ReactionBar({ post, canReact }: { post: Detail; canReact: boolean }) {
  const { likedByMe, likeCount, commentCount, toggleLike, openLikers } = useReactionBar(
    post,
    canReact,
  );

  return (
    <div className={styles.reactions}>
      {canReact && (
        <button
          type="button"
          className={styles.likeButton}
          aria-pressed={likedByMe}
          onClick={toggleLike}
        >
          <Heart aria-hidden className={likedByMe ? styles.heartOn : styles.heart} />
          좋아요
        </button>
      )}
      <button type="button" className={styles.countButton} onClick={openLikers}>
        좋아요 {likeCount.toLocaleString('ko-KR')}
        <span className="sr-only">명, 좋아요한 사람 보기</span>
      </button>
      <span className={styles.commentCount}>
        <MessageCircle aria-hidden className={styles.metaIcon} />
        댓글 {commentCount.toLocaleString('ko-KR')}
      </span>
    </div>
  );
}

/** Plain text with line breaks; https links leave through the external-link confirm (POL-P-2) */
function PostBody({ text }: { text: string }) {
  const openExternal = useOpenExternal();
  return (
    <p className={styles.body}>
      {linkify(text).map((part, index) =>
        part.kind === 'link' ? (
          <a
            key={index}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
            onClick={(event) => {
              event.preventDefault();
              openExternal(part.value);
            }}
          >
            {part.value}
            <span className="sr-only"> (새 창)</span>
          </a>
        ) : (
          part.value
        ),
      )}
    </p>
  );
}

function PostFields({ post }: { post: Detail }) {
  const openExternal = useOpenExternal();
  const hasFields =
    post.myRole || post.period || post.teamSize !== null || post.demoLinks.length > 0;
  if (!hasFields && post.tags.length === 0) return null;

  return (
    <section aria-labelledby="post-fields" className={styles.section}>
      <h3 id="post-fields" className={styles.sectionTitle}>
        프로젝트 정보
      </h3>
      {hasFields && (
        <dl className={styles.info}>
          {post.myRole && (
            <div className={styles.infoRow}>
              <dt>내 역할</dt>
              <dd>{post.myRole}</dd>
            </div>
          )}
          {post.period && (
            <div className={styles.infoRow}>
              <dt>진행 기간</dt>
              <dd>
                {monthLabel(post.period.start)} ~{' '}
                {post.period.end ? monthLabel(post.period.end) : '진행 중'}
              </dd>
            </div>
          )}
          {post.teamSize !== null && (
            <div className={styles.infoRow}>
              <dt>팀 규모</dt>
              <dd>{post.teamSize}명</dd>
            </div>
          )}
          {post.demoLinks.length > 0 && (
            <div className={styles.infoRow}>
              <dt>데모</dt>
              <dd>
                <ul className={styles.links}>
                  {post.demoLinks.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.link}
                        onClick={(event) => {
                          event.preventDefault();
                          openExternal(url);
                        }}
                      >
                        {url.replace(/^https:\/\//, '')}
                        <span className="sr-only"> (새 창)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      )}
      {post.tags.length > 0 && (
        <ul className={styles.tags} aria-label="태그">
          {post.tags.map((tag) => (
            <li key={tag} className={styles.tag}>
              {tag}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Repo card with my commits and handled issues; private or deleted → "레포를 볼 수 없음" (POL-P-1) */
function RepoCard({ post }: { post: Detail }) {
  const openExternal = useOpenExternal();
  const { repo } = post;
  const available = repo.state === 'PUBLIC';

  return (
    <section aria-labelledby="post-repo" className={styles.repoCard}>
      <h3 id="post-repo" className={styles.repoName}>
        {repo.fullName}
      </h3>
      {available ? (
        <>
          <p className={styles.repoMeta}>
            {repo.language && <span>{repo.language}</span>}
            <span className={styles.iconText}>
              <Star aria-hidden className={styles.metaIcon} />
              <span className="sr-only">스타 </span>
              {repo.stars}
            </span>
            <span className={styles.iconText}>
              <GitFork aria-hidden className={styles.metaIcon} />
              <span className="sr-only">포크 수 </span>
              {repo.forks}
            </span>
            {repo.isFork && <span className={styles.forkBadge}>포크</span>}
          </p>
          {repo.description && <p className={styles.repoDescription}>{repo.description}</p>}
        </>
      ) : (
        <p className={styles.unavailable}>레포를 볼 수 없음</p>
      )}
      <dl className={styles.contribution}>
        <div>
          <dt>{post.author.name}님의 커밋</dt>
          <dd>{repo.authorCommitCount}개</dd>
        </div>
        <div>
          <dt>Linker에서 처리한 이슈</dt>
          <dd>{repo.handledIssueCount}개</dd>
        </div>
      </dl>
      {available && (
        <>
          <button
            type="button"
            className={styles.githubLink}
            onClick={() => openExternal(`https://github.com/${repo.fullName}`)}
          >
            GitHub에서 보기
            <ExternalLink aria-hidden className={styles.metaIcon} />
          </button>
          <ReadmeSection postId={String(post.id)} />
        </>
      )}
    </section>
  );
}

/** Teammates who posted the same repo (04 ch. 4 exceptions) */
function SameRepoPosts({ postId }: { postId: string }) {
  const items = useSameRepoPosts(postId);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="same-repo" className={styles.section}>
      <h3 id="same-repo" className={styles.sectionTitle}>
        이 레포의 다른 게시물
      </h3>
      <ul className={styles.samePosts}>
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/posts/${item.id}` as Route} className={styles.samePost}>
              <span className={styles.samePostIntro}>{item.intro}</span>
              <span className={styles.meta}>{item.author.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
