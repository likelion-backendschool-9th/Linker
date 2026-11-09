'use client';

// Own region: flat comment list and the composer (Figma 287:328)
import { ArrowUp } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { formatFullDate, toKstIso } from '@/lib/format/time';

import type { PostComment, PostDetail } from '../../_lib/post-detail-queries';
import styles from '../comments.module.css';
import { useCommentComposer, useCommentSection } from './hook';

type CommentSectionProps = {
  post: PostDetail;
  /** Hidden posts block new comments (04 ch. 4 exceptions); recruiters only read (04 ch. 2) */
  canWrite: boolean;
};

export function CommentSection({ post, canWrite }: CommentSectionProps) {
  const { titleId, comments, items } = useCommentSection(post);

  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <h3 id={titleId} className="sr-only">
        댓글 {items.length}
      </h3>

      {canWrite && <Composer post={post} />}

      {comments.isPending ? (
        <div className={styles.state}>
          <Skeleton count={2} />
        </div>
      ) : comments.isError ? (
        <div className={styles.state}>
          <ErrorState title="댓글을 불러오지 못했어요" onRetry={() => void comments.refetch()} />
        </div>
      ) : (
        items.length > 0 && (
          <ul className={styles.list}>
            {items.map((comment) => (
              <li key={comment.id} className={styles.item}>
                <CommentItem comment={comment} />
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}

/** Figma 287:293: photo 44, name / @login, full date on the right, text 20 below */
function CommentItem({ comment }: { comment: PostComment }) {
  const nameId = `comment-${comment.id}-author`;

  return (
    <article aria-labelledby={nameId} className={styles.comment}>
      <div className={styles.head}>
        <Link href={`/user/${comment.author.login}` as Route} className={styles.author}>
          <Image
            src={comment.author.avatarUrl}
            alt=""
            width={44}
            height={44}
            sizes="44px"
            className={styles.avatar}
          />
          <span className={styles.authorText}>
            <span id={nameId} className={styles.name}>
              {comment.author.name}
            </span>
            <span className={styles.login}>@{comment.author.login}</span>
          </span>
        </Link>
        <time dateTime={toKstIso(comment.createdAt)} className={styles.date}>
          {formatFullDate(comment.createdAt)}
        </time>
      </div>
      <p className={styles.text}>{comment.text}</p>
    </article>
  );
}

/** Figma 287:317: one 42px cool field with the blue send button inside */
function Composer({ post }: { post: PostDetail }) {
  const { id, isGuest, promptLogin, text, setText, error, writePending, submit } =
    useCommentComposer(post);

  // Guests see the same field; tapping it asks them to log in (POL-A-9)
  if (isGuest) {
    return (
      <button type="button" className={styles.field} onClick={promptLogin}>
        <span className={styles.guestPlaceholder}>댓글을 작성해 주세요</span>
        <span className="sr-only"> (로그인이 필요해요)</span>
        <span className={styles.send} aria-hidden>
          <ArrowUp className={styles.sendIcon} />
        </span>
      </button>
    );
  }

  return (
    <form className={styles.composer} noValidate onSubmit={submit}>
      <div className={styles.field}>
        <label htmlFor={`${id}-text`} className="sr-only">
          댓글
        </label>
        <textarea
          id={`${id}-text`}
          className={styles.input}
          rows={1}
          value={text}
          placeholder="댓글을 작성해 주세요"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" className={styles.send} aria-disabled={writePending}>
          <ArrowUp aria-hidden className={styles.sendIcon} />
          <span className="sr-only">{writePending ? '등록 중' : '등록'}</span>
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
