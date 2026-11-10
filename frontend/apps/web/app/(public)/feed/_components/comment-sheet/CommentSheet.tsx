'use client';

// overlay: the feed card's comment icon opens "댓글 N개" (Figma 374:3944 / 374:4092)
import { ArrowUp } from 'lucide-react';
import Image from 'next/image';
import { useRef } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { formatFullDate, toKstIso } from '@/lib/format/time';

import type { PostComment } from './api';
import styles from './CommentSheet.module.css';
import { useCommentComposer, useCommentSheet } from './hook';

/**
 * Header ("댓글 N개" + ×) stays put; only the list scrolls (smooth, no scrollbar) between it and the
 * composer. The sheet is at most the viewport height minus 100px.
 */
export function CommentSheet() {
  const { overlay, postId, comments, items } = useCommentSheet();
  const list = useRef<HTMLDivElement>(null);
  const count = comments.data ? items.length : null;

  return (
    <OverlaySheet
      overlay={overlay}
      title={
        <>
          댓글
          {count !== null && (
            <span className={styles.count}>{count.toLocaleString('ko-KR')}개</span>
          )}
        </>
      }
      description="이 게시물의 댓글이에요."
      describeHidden
      classNames={{
        scrim: styles.scrim,
        sheet: styles.sheet,
        header: styles.header,
        title: styles.title,
        close: styles.close,
        body: styles.body,
      }}
    >
      <div ref={list} className={styles.list}>
        {comments.isPending ? (
          // One short line, not a tall skeleton: the sheet's height follows its content, so a
          // placeholder taller than the comments would open it high and then shrink it
          <p role="status" className={styles.empty}>
            댓글을 불러오고 있어요.
          </p>
        ) : comments.isError ? (
          <ErrorState title="댓글을 불러오지 못했어요" onRetry={() => void comments.refetch()} />
        ) : items.length === 0 ? (
          <p className={styles.empty}>아직 댓글이 없어요.</p>
        ) : (
          <ul className={styles.comments}>
            {items.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </ul>
        )}
      </div>
      {postId && (
        <Composer
          key={postId}
          postId={postId}
          onWritten={() =>
            list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
          }
        />
      )}
    </OverlaySheet>
  );
}

/** Comment — Figma 374:4161: photo 44, name / @login, date top right, then the text 20 below */
function CommentItem({ comment }: { comment: PostComment }) {
  return (
    <li className={styles.comment}>
      <article className={styles.commentBody}>
        <div className={styles.authorRow}>
          <div className={styles.author}>
            <Image
              src={comment.author.avatarUrl}
              alt=""
              width={44}
              height={44}
              sizes="44px"
              className={styles.avatar}
            />
            <div className={styles.names}>
              <p className={styles.name}>{comment.author.name}</p>
              <p className={styles.login}>@{comment.author.login}</p>
            </div>
          </div>
          <time className={styles.date} dateTime={toKstIso(comment.createdAt)}>
            {formatFullDate(comment.createdAt)}
          </time>
        </div>
        <p className={styles.text}>{comment.text}</p>
      </article>
    </li>
  );
}

/** Composer — Figma 374:4131: pill input + 42 send circle, 10 apart */
function Composer({ postId, onWritten }: { postId: string; onWritten: () => void }) {
  const { inputId, input, canWrite, isGuest, promptLogin, text, setText, pending, submit } =
    useCommentComposer(postId, onWritten);
  if (!canWrite) return null;

  return (
    <form className={styles.composer} onSubmit={submit} aria-busy={pending || undefined}>
      <label htmlFor={inputId} className="sr-only">
        댓글
      </label>
      <input
        ref={input}
        id={inputId}
        type="text"
        className={styles.input}
        placeholder="채팅을 입력해 주세요."
        autoComplete="off"
        enterKeyHint="send"
        value={text}
        readOnly={isGuest}
        onChange={(event) => setText(event.target.value)}
        onFocus={(event) => {
          // Guests can't write: hand them the login sheet instead of a keyboard
          if (!isGuest) return;
          event.currentTarget.blur();
          promptLogin();
        }}
      />
      <button type="submit" className={styles.send} aria-disabled={pending || undefined}>
        <ArrowUp aria-hidden className={styles.sendIcon} />
        <span className="sr-only">댓글 보내기</span>
      </button>
    </form>
  );
}
