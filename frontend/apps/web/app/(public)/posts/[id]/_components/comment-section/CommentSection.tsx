'use client';

// Own region: comments with one level of replies, composer, inline edit (07 TODO 23, POL-P-5)
import { MoreHorizontal } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { CharCounter } from '@/components/ui/char-counter/CharCounter';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import type { PostComment, PostDetail } from '../../_lib/post-detail-queries';
import { CommentMenuSheet } from '../comment-menu-sheet';
import styles from '../comments.module.css';
import {
  useCommentComposer,
  useCommentEdit,
  useCommentItem,
  useCommentSection,
  type CommentComposerRef,
} from './hook';

type CommentSectionProps = {
  post: PostDetail;
  /** Hidden posts block new comments (04 ch. 4 exceptions); recruiters only read (04 ch. 2) */
  canWrite: boolean;
};

export function CommentSection({ post, canWrite }: CommentSectionProps) {
  const {
    titleId,
    comments,
    items,
    threads,
    repliesOf,
    total,
    replyTo,
    editingId,
    composer,
    startReply,
    cancelReply,
    clearReply,
    clearEditing,
    startEdit,
  } = useCommentSection(post);

  const renderComment = (comment: PostComment) => (
    <CommentItem
      post={post}
      comment={comment}
      editing={editingId === comment.id}
      canReply={canWrite && comment.parentId === null && !comment.deleted}
      onReply={() => startReply(comment)}
      onEditDone={clearEditing}
    />
  );

  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <h3 id={titleId} className={styles.title}>
        댓글 {total}
      </h3>

      {canWrite && (
        <Composer
          post={post}
          textarea={composer}
          replyTo={replyTo}
          onCancelReply={cancelReply}
          onDone={clearReply}
        />
      )}

      {comments.isPending ? (
        <Skeleton count={2} />
      ) : comments.isError ? (
        <ErrorState title="댓글을 불러오지 못했어요" onRetry={() => void comments.refetch()} />
      ) : threads.length === 0 ? (
        <p className={styles.empty}>
          {canWrite ? '아직 댓글이 없어요. 첫 댓글을 남겨 보세요.' : '아직 댓글이 없어요.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {threads.map((comment) => {
            const replies = repliesOf(comment.id);
            return (
              <li key={comment.id}>
                {renderComment(comment)}
                {replies.length > 0 && (
                  <ul
                    className={styles.replies}
                    aria-label={`${comment.author.name}님 댓글의 답글`}
                  >
                    {replies.map((reply) => (
                      <li key={reply.id}>{renderComment(reply)}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <CommentMenuSheet post={post} comments={items} onEdit={startEdit} />
    </section>
  );
}

type CommentItemProps = {
  post: PostDetail;
  comment: PostComment;
  editing: boolean;
  canReply: boolean;
  onReply: () => void;
  onEditDone: () => void;
};

function CommentItem({ post, comment, editing, canReply, onReply, onEditDone }: CommentItemProps) {
  const { nameId, openMenu } = useCommentItem(comment);
  const byPostAuthor = comment.author.id === post.author.id;

  return (
    <article aria-labelledby={nameId} className={styles.comment}>
      <Image
        src={comment.author.avatarUrl}
        alt=""
        width={32}
        height={32}
        sizes="32px"
        className={styles.avatar}
      />
      <div className={styles.body}>
        <div className={styles.head}>
          <Link id={nameId} href={`/user/${comment.author.login}` as Route} className={styles.name}>
            {comment.author.name}
          </Link>
          {byPostAuthor && <span className={styles.badge}>작성자</span>}
          <span className={styles.meta}>
            <RelativeTime value={comment.createdAt} />
            {comment.editedAt && ' · 수정됨'}
          </span>
          {!comment.deleted && (
            <button type="button" className={styles.more} onClick={openMenu}>
              <MoreHorizontal aria-hidden />
              <span className="sr-only">{comment.author.name}님 댓글 더보기</span>
            </button>
          )}
        </div>
        {editing ? (
          <EditForm post={post} comment={comment} onDone={onEditDone} />
        ) : (
          <p className={comment.deleted ? styles.deleted : styles.text}>{comment.text}</p>
        )}
        {canReply && !editing && (
          <button type="button" className={styles.reply} onClick={onReply}>
            답글 달기
            <span className="sr-only">: {comment.author.name}님 댓글</span>
          </button>
        )}
      </div>
    </article>
  );
}

type ComposerProps = {
  post: PostDetail;
  textarea: CommentComposerRef;
  replyTo: PostComment | null;
  onCancelReply: () => void;
  onDone: () => void;
};

function Composer({ post, textarea, replyTo, onCancelReply, onDone }: ComposerProps) {
  const { id, isGuest, promptLogin, text, setText, error, count, max, writePending, submit } =
    useCommentComposer({ post, replyTo, onDone });

  // Guests see where the input would be; tapping it asks them to log in (POL-A-9)
  if (isGuest) {
    return (
      <button type="button" className={styles.loginPrompt} onClick={promptLogin}>
        로그인하고 댓글 남기기
      </button>
    );
  }

  return (
    <form className={styles.composer} noValidate onSubmit={submit}>
      {replyTo && (
        <p className={styles.replyingTo}>
          {replyTo.author.name}님에게 답글 남기는 중
          <button type="button" className={styles.cancelReply} onClick={onCancelReply}>
            취소
          </button>
        </p>
      )}
      <label htmlFor={`${id}-text`} className="sr-only">
        {replyTo ? `${replyTo.author.name}님에게 답글` : '댓글'}
      </label>
      <textarea
        id={`${id}-text`}
        ref={textarea}
        className={styles.input}
        rows={3}
        value={text}
        placeholder={replyTo ? '답글을 남겨 주세요.' : '댓글을 남겨 주세요.'}
        aria-invalid={error ? true : undefined}
        aria-describedby={[`${id}-count`, error ? `${id}-error` : null].filter(Boolean).join(' ')}
        onChange={(event) => setText(event.target.value)}
      />
      <div className={styles.composerFoot}>
        {error ? (
          <p id={`${id}-error`} className={styles.error} role="alert">
            {error}
          </p>
        ) : (
          <span />
        )}
        <div className={styles.composerActions}>
          <CharCounter id={`${id}-count`} count={count} max={max} />
          <Button type="submit" aria-disabled={writePending}>
            {writePending ? '등록 중…' : '등록'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function EditForm({
  post,
  comment,
  onDone,
}: {
  post: PostDetail;
  comment: PostComment;
  onDone: () => void;
}) {
  const { id, text, setText, error, count, max, savePending, submit } = useCommentEdit({
    post,
    comment,
    onDone,
  });

  return (
    <form className={styles.composer} noValidate onSubmit={submit}>
      <label htmlFor={`${id}-text`} className="sr-only">
        댓글 수정
      </label>
      <textarea
        id={`${id}-text`}
        className={styles.input}
        rows={3}
        value={text}
        autoFocus
        aria-invalid={error ? true : undefined}
        aria-describedby={[`${id}-count`, error ? `${id}-error` : null].filter(Boolean).join(' ')}
        onChange={(event) => setText(event.target.value)}
      />
      <div className={styles.composerFoot}>
        {error ? (
          <p id={`${id}-error`} className={styles.error} role="alert">
            {error}
          </p>
        ) : (
          <span />
        )}
        <div className={styles.composerActions}>
          <CharCounter id={`${id}-count`} count={count} max={max} />
          <Button variant="outline" onClick={onDone}>
            취소
          </Button>
          <Button type="submit" aria-disabled={savePending}>
            저장
          </Button>
        </div>
      </div>
    </form>
  );
}
