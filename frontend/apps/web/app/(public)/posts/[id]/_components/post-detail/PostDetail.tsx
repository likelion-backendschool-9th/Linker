'use client';

// Client boundary: viewer-dependent actions (like, comment, menus), optimistic like, sheets
import { ChatRoundLinearIcon } from '@solar-icons/static/linear/chat-round';
import { HeartBoldIcon } from '@solar-icons/static/bold/heart';
import { LinkMinimalisticBoldIcon } from '@solar-icons/static/bold/link-minimalistic';
import { AltArrowRightLinearIcon } from '@solar-icons/static/linear/alt-arrow-right';
import { HeartOutlineIcon } from '@solar-icons/static/outline/heart';
import { Plane3OutlineIcon } from '@solar-icons/static/outline/plane-3';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { openExternalNow } from '@/features/external-link/open-external';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import { GitHubMark } from '@/features/github/github-mark/GithubMark';
import { formatWrittenDate, toKstIso } from '@/lib/format/time';

import { ShareDrawer } from '../../../../_components/share-drawer';
import { linkify } from '../../_lib/linkify';
import type { PostDetail as Detail } from '../../_lib/post-detail-queries';
import { CommentSection } from '../comment-section';
import { LikersSheet } from '../likers-sheet';
import { PhotoCarousel } from '../photo-carousel';
import { PostMenuSheet } from '../post-menu-sheet';
import { SameRepoPosts } from '../same-repo-posts';
import styles from './PostDetail.module.css';
import { useFollowAuthor, usePostDetail, useReactionBar } from './hook';

/**
 * 23 Project post detail (Figma 285:154). Guests read everything but like / comment / more ask them
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

  const [owner = '', repoName = post.repo.fullName] = post.repo.fullName.split('/');
  // 22 saves up to 4 picked roles joined with ", " (POL-P-2); each gets its own chip (Figma 285:238)
  const roles = post.myRole
    ? post.myRole
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean)
    : [];

  return (
    <>
      {underReview && (
        <p className={styles.review} role="status">
          <strong>검토 중</strong> 신고가 들어와 검토하고 있어요. 검토가 끝날 때까지 다른 사람에게는
          보이지 않아요.
        </p>
      )}

      <article aria-labelledby="post-intro" className={styles.post}>
        {post.photos.length > 0 && <PhotoCarousel photos={post.photos} repoName={repoName} />}
        <AuthorRow post={post} />

        <div className={styles.content}>
          <header className={styles.head}>
            <div className={styles.titleLead}>
              {(roles.length > 0 || post.repo.isFork) && (
                <p className={styles.chips}>
                  {roles.length > 0 && <span className="sr-only">내 역할 </span>}
                  {roles.map((role, index) => (
                    <span
                      key={role}
                      className={index % 2 === 0 ? styles.roleChip : styles.roleChipAlt}
                    >
                      {role}
                    </span>
                  ))}
                  {/* Forked repo (04 ch. 4 exceptions): same chip as the role, next to it */}
                  {post.repo.isFork && (
                    <span className={styles.roleChip}>
                      Fork<span className="sr-only"> 레포</span>
                    </span>
                  )}
                </p>
              )}
              <h2 id="post-intro" className={styles.intro}>
                {post.intro}
              </h2>
            </div>
            <p className={styles.date}>
              <time dateTime={toKstIso(post.createdAt)}>{formatWrittenDate(post.createdAt)}</time>
            </p>
          </header>

          {post.body && <PostBody text={post.body} />}
          <DemoLinks links={post.demoLinks} />
          {post.tags.length > 0 && (
            <ul className={styles.tags} aria-label="태그">
              {post.tags.map((tag) => (
                <li key={tag} className={styles.tag}>
                  {tag}
                </li>
              ))}
            </ul>
          )}
          <RepoCard post={post} owner={owner} repoName={repoName} />
          {post.visibility === 'VISIBLE' && <SameRepoPosts postId={postId} />}
        </div>

        <hr className={styles.band} />
        <ReactionBar post={post} canReact={canReact} />
        <CommentSection post={post} canWrite={canReact} />
      </article>

      <PostMenuSheet post={post} />
      <LikersSheet postId={postId} />
      {/* Same "공유하기" board as 24's feed cards (Figma 780:584) */}
      {post.visibility === 'VISIBLE' && <ShareDrawer />}
    </>
  );
}

/** Figma 287:329: photo, name, @login, follow (borrowed from 04's follow API) */
function AuthorRow({ post }: { post: Detail }) {
  const follow = useFollowAuthor(post);
  return (
    <div className={styles.authorRow}>
      <Link href={`/user/${post.author.login}` as Route} className={styles.author}>
        <Image
          src={post.author.avatarUrl}
          alt=""
          width={44}
          height={44}
          sizes="44px"
          className={styles.avatar}
        />
        <span className={styles.authorText}>
          <span className={styles.authorName}>{post.author.name}</span>
          <span className={styles.login}>@{post.author.login}</span>
        </span>
      </Link>
      {follow.visible && (
        <button
          type="button"
          className={styles.follow}
          aria-pressed={follow.following}
          aria-disabled={follow.pending || undefined}
          onClick={follow.toggle}
        >
          {follow.following ? '팔로잉' : '팔로우'}
        </button>
      )}
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

/** Figma 287:442: one outlined "프로젝트 주소" button per demo link; the address is for screen readers */
function DemoLinks({ links }: { links: string[] }) {
  const openExternal = useOpenExternal();
  if (links.length === 0) return null;

  return (
    <ul className={styles.demoLinks} aria-label="프로젝트 링크">
      {links.map((url) => (
        <li key={url}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.demoLink}
            onClick={(event) => {
              event.preventDefault();
              openExternal(url);
            }}
          >
            프로젝트 주소
            <span className="sr-only"> {url.replace(/^https:\/\//, '')} (새 창)</span>
            <Icon svg={LinkMinimalisticBoldIcon} className={styles.demoLinkIcon} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Figma 287:399: GitHub mark, repo name, owner. Private or deleted → "레포를 볼 수 없음" (POL-P-1).
 * Opens GitHub straight away, without the "외부 사이트로 이동합니다" sheet (04 ch. 2 exception: the
 * repo card's own github.com link); the app still hands it to the system browser.
 */
function RepoCard({ post, owner, repoName }: { post: Detail; owner: string; repoName: string }) {
  const available = post.repo.state === 'PUBLIC';
  const href = `https://github.com/${post.repo.fullName}`;

  const summary = (
    <>
      <GitHubMark className={styles.githubMark} />
      <span className={styles.repoText}>
        <span className={styles.repoName}>{repoName}</span>
        <span className={styles.repoOwner}>{available ? owner : '레포를 볼 수 없음'}</span>
      </span>
    </>
  );

  return available ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.repoCard}
      onClick={(event) => {
        event.preventDefault();
        openExternalNow(href);
      }}
    >
      {summary}
      <span className="sr-only"> GitHub에서 보기 (새 창)</span>
      <Icon svg={AltArrowRightLinearIcon} className={styles.repoChevron} />
    </a>
  ) : (
    <div className={styles.repoCard}>{summary}</div>
  );
}

/** Figma 287:450: like (toggle) + count (likers sheet), comment count, share */
function ReactionBar({ post, canReact }: { post: Detail; canReact: boolean }) {
  const { likedByMe, likeCount, commentCount, toggleLike, openLikers, prefetchRooms, openShare } =
    useReactionBar(post, canReact);
  const heart = (
    <Icon svg={likedByMe ? HeartBoldIcon : HeartOutlineIcon} className={styles.heart} />
  );

  return (
    <div className={styles.reactions}>
      <span className={styles.stat}>
        {canReact ? (
          <button
            type="button"
            className={styles.statButton}
            aria-pressed={likedByMe}
            onClick={toggleLike}
          >
            {heart}
            <span className="sr-only">좋아요</span>
          </button>
        ) : (
          heart
        )}
        <button
          type="button"
          className={styles.statCount}
          aria-label={`좋아요 ${likeCount.toLocaleString('ko-KR')}명, 좋아요한 사람 보기`}
          onClick={openLikers}
        >
          {likeCount.toLocaleString('ko-KR')}
        </button>
      </span>
      <span className={styles.stat}>
        <Icon svg={ChatRoundLinearIcon} className={styles.statIcon} />
        <span className={styles.statCount}>
          <span className="sr-only">댓글 </span>
          {commentCount.toLocaleString('ko-KR')}
        </span>
      </span>
      {post.visibility === 'VISIBLE' && (
        <button
          type="button"
          className={styles.statButton}
          aria-haspopup="dialog"
          onPointerDown={prefetchRooms}
          onFocus={prefetchRooms}
          onClick={openShare}
        >
          <Icon svg={Plane3OutlineIcon} className={styles.statIcon} />
          <span className="sr-only">채팅방에 공유</span>
        </button>
      )}
    </div>
  );
}
