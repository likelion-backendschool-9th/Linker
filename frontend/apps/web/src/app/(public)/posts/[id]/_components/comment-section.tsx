'use client';

// Own region: comments with one level of replies, composer, inline edit (07 TODO 23, POL-P-5)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { ErrorState } from '@/components/ui/error-state';
import { RelativeTime } from '@/components/ui/relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { useRequireLogin } from '@/features/auth/use-require-login';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { POST } from '@/lib/policy';

import {
  commentsOptions,
  editComment,
  postKeys,
  writeComment,
  type PostComment,
  type PostDetail,
} from '../_lib/post-detail-queries';
import { CommentMenuSheet } from './comment-menu-sheet';
import styles from './comments.module.css';

type CommentSectionProps = {
  post: PostDetail;
  /** Hidden posts block new comments (04 ch. 4 exceptions); recruiters only read (04 ch. 2) */
  canWrite: boolean;
};

/** Why a write failed, with the 04 ch. 12 copy */
function writeErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
    return '잠시 후 다시 시도해 주세요.';
  }
  if (error instanceof ApiError && error.status < 500) return error.message;
  return '댓글을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export function CommentSection({ post, canWrite }: CommentSectionProps) {
  const id = useId();
  const postId = String(post.id);
  const comments = useQuery(commentsOptions(postId));
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const items = comments.data?.items ?? [];
  const threads = items.filter((comment) => comment.parentId === null);
  const repliesOf = (parentId: number) => items.filter((comment) => comment.parentId === parentId);
  const total = items.filter((comment) => !comment.deleted).length;

  const startReply = (comment: PostComment) => {
    setReplyTo(comment);
    composer.current?.focus();
  };

  const renderComment = (comment: PostComment) => (
    <CommentItem
      post={post}
      comment={comment}
      editing={editingId === comment.id}
      canReply={canWrite && comment.parentId === null && !comment.deleted}
      onReply={() => startReply(comment)}
      onEditDone={() => setEditingId(null)}
    />
  );

  return (
    <section aria-labelledby={`${id}-title`} className={styles.section}>
      <h3 id={`${id}-title`} className={styles.title}>
        댓글 {total}
      </h3>

      {canWrite && (
        <Composer
          post={post}
          textarea={composer}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onDone={() => setReplyTo(null)}
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

      <CommentMenuSheet
        post={post}
        comments={items}
        onEdit={(commentId) => {
          setReplyTo(null);
          setEditingId(commentId);
        }}
      />
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
  const requireLogin = useRequireLogin();
  const menu = useOverlay('comment-menu');
  const nameId = `comment-${comment.id}-author`;
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
            <button
              type="button"
              className={styles.more}
              onClick={() => {
                if (requireLogin()) menu.open(String(comment.id));
              }}
            >
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
  textarea: React.RefObject<HTMLTextAreaElement | null>;
  replyTo: PostComment | null;
  onCancelReply: () => void;
  onDone: () => void;
};

function Composer({ post, textarea, replyTo, onCancelReply, onDone }: ComposerProps) {
  const id = useId();
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const client = useQueryClient();
  const postId = String(post.id);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const count = countChars(text);

  const write = useMutation({
    mutationFn: () =>
      writeComment(postId, {
        text: normalizeLineBreaks(text.trim()),
        parentId: replyTo?.id ?? null,
      }),
    onSuccess: async () => {
      setText('');
      onDone();
      await Promise.all([
        client.invalidateQueries({ queryKey: postKeys.comments(postId) }),
        client.invalidateQueries({ queryKey: postKeys.detail(viewer.login, postId) }),
      ]);
    },
    onError: (failure) => setError(writeErrorMessage(failure)),
  });

  // Guests see where the input would be; tapping it asks them to log in (POL-A-9)
  if (viewer.role === 'guest') {
    return (
      <button type="button" className={styles.loginPrompt} onClick={() => requireLogin()}>
        로그인하고 댓글 남기기
      </button>
    );
  }

  return (
    <form
      className={styles.composer}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (write.isPending) return;
        if (count === 0) return setError('댓글을 입력해 주세요.');
        if (count > POST.commentMax)
          return setError(`댓글은 ${POST.commentMax}자까지 쓸 수 있어요.`);
        setError(null);
        write.mutate();
      }}
    >
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
          <CharCounter id={`${id}-count`} count={count} max={POST.commentMax} />
          <Button type="submit" aria-disabled={write.isPending}>
            {write.isPending ? '등록 중…' : '등록'}
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
  const id = useId();
  const client = useQueryClient();
  const postId = String(post.id);
  const [text, setText] = useState(comment.text ?? '');
  const [error, setError] = useState<string | null>(null);
  const count = countChars(text);
  const save = useMutation({
    mutationFn: () => editComment(postId, comment.id, normalizeLineBreaks(text.trim())),
    onSuccess: async () => {
      onDone();
      await client.invalidateQueries({ queryKey: postKeys.comments(postId) });
    },
    onError: (failure) => setError(writeErrorMessage(failure)),
  });

  return (
    <form
      className={styles.composer}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (save.isPending) return;
        if (count === 0) return setError('댓글을 입력해 주세요.');
        if (count > POST.commentMax)
          return setError(`댓글은 ${POST.commentMax}자까지 쓸 수 있어요.`);
        save.mutate();
      }}
    >
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
          <CharCounter id={`${id}-count`} count={count} max={POST.commentMax} />
          <Button variant="outline" onClick={onDone}>
            취소
          </Button>
          <Button type="submit" aria-disabled={save.isPending}>
            저장
          </Button>
        </div>
      </div>
    </form>
  );
}
