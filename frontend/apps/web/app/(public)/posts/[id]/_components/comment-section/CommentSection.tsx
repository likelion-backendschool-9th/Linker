'use client';

// Own region: flat comment list and the composer (Figma 287:328)
import { ArrowUp, EllipsisVertical } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { DropdownMenu } from 'radix-ui';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { formatFullDate, toKstIso } from '@/lib/format/time';

import type { PostComment, PostDetail } from '../../_lib/post-detail-queries';
import styles from '../comments.module.css';
import {
  useCommentComposer,
  useCommentDeleteDialog,
  useCommentItem,
  useCommentSection,
} from './hook';

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
                <CommentItem post={post} comment={comment} />
              </li>
            ))}
          </ul>
        )
      )}
      <CommentDeleteDialog post={post} />
    </section>
  );
}

/** Figma 287:293: photo 44, name / @login, full date on the right, text 20 below */
function CommentItem({ post, comment }: { post: PostDetail; comment: PostComment }) {
  const nameId = `comment-${comment.id}-author`;
  const item = useCommentItem(post, comment);

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
        <span className={styles.meta}>
          <time dateTime={toKstIso(comment.createdAt)} className={styles.date}>
            {formatFullDate(comment.createdAt)}
            {comment.editedAt && <span className={styles.edited}> · 수정됨</span>}
          </time>
          <CommentMenu item={item} />
        </span>
      </div>
      {item.editing ? (
        <form className={styles.composer} noValidate onSubmit={item.save}>
          <div className={styles.field}>
            <label htmlFor={`${item.id}-edit`} className="sr-only">
              댓글 수정
            </label>
            <textarea
              id={`${item.id}-edit`}
              className={styles.input}
              rows={1}
              value={item.text}
              aria-invalid={item.error ? true : undefined}
              aria-describedby={item.error ? `${item.id}-edit-error` : undefined}
              onChange={(event) => item.setText(event.target.value)}
              // The field opened on purpose from the menu, so typing can start at once
              autoFocus
            />
          </div>
          {item.error && (
            <p id={`${item.id}-edit-error`} className={styles.error} role="alert">
              {item.error}
            </p>
          )}
          <div className={styles.editActions}>
            <button type="button" className={styles.editButton} onClick={item.cancelEdit}>
              취소
            </button>
            <button
              type="submit"
              className={styles.editButton}
              aria-disabled={item.savePending || undefined}
            >
              {item.savePending ? '저장 중' : '저장'}
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.text}>{comment.text}</p>
      )}
    </article>
  );
}

/** Same dropdown as the header "더보기" (Figma 622:347), per comment */
function CommentMenu({ item }: { item: ReturnType<typeof useCommentItem> }) {
  const icon = (
    <>
      <EllipsisVertical aria-hidden className={styles.menuIcon} />
      <span className="sr-only">댓글 더보기</span>
    </>
  );

  if (item.isGuest) {
    return (
      <button type="button" className={styles.menuTrigger} onClick={item.promptLogin}>
        {icon}
      </button>
    );
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={styles.menuTrigger}>
          {icon}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.menuPanel}
          side="bottom"
          align="end"
          sideOffset={4}
          collisionPadding={16}
        >
          {item.canEdit && (
            <DropdownMenu.Item className={styles.menuItem} onSelect={item.startEdit}>
              수정하기
            </DropdownMenu.Item>
          )}
          {item.canDelete && (
            <DropdownMenu.Item className={styles.menuItem} onSelect={item.openDelete}>
              삭제하기
            </DropdownMenu.Item>
          )}
          {item.canReport && (
            <DropdownMenu.Item className={styles.menuItem} onSelect={item.openReport}>
              신고 하기
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function CommentDeleteDialog({ post }: { post: PostDetail }) {
  const { overlay, removePending, error, confirmDelete } = useCommentDeleteDialog(post);
  return (
    <ConfirmDialog
      overlay={overlay}
      title="댓글을 삭제할까요?"
      description="삭제한 댓글은 되돌릴 수 없어요."
      confirmLabel="삭제"
      destructive
      pending={removePending}
      error={error}
      onConfirm={confirmDelete}
    />
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
