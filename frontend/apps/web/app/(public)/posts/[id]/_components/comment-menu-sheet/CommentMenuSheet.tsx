'use client';

// Overlay: comment "더보기" — mine: edit / delete; post owner: delete; others: report (POL-P-5)
import { Flag, Pencil, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { reportTargetId } from '@/features/report/report-target';

import type { PostComment, PostDetail } from '../../_lib/post-detail-queries';
import styles from '../post-detail/PostDetail.module.css';
import { useCommentMenuSheet } from './hook';

type CommentMenuSheetProps = {
  post: PostDetail;
  comments: PostComment[];
  onEdit: (commentId: number) => void;
};

export function CommentMenuSheet({ post, comments, onEdit }: CommentMenuSheetProps) {
  const {
    menu,
    deleteDialog,
    report,
    comment,
    mine,
    deleting,
    isAuthor,
    removePending,
    hasReplies,
    openDelete,
    confirmDelete,
  } = useCommentMenuSheet({ post, comments });

  return (
    <>
      <OverlaySheet
        overlay={menu}
        title="댓글 더보기"
        description="이 댓글에 할 수 있는 일이에요."
        describeHidden
      >
        {comment && (
          <ul className={styles.menu}>
            {mine && (
              <li>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => void menu.closeAnd(() => onEdit(comment.id))}
                >
                  <Pencil aria-hidden />
                  수정하기
                </button>
              </li>
            )}
            {(mine || isAuthor) && (
              <li>
                {/* Opening another overlay replaces this one in the URL (blueprint ch. 7) */}
                <button
                  type="button"
                  className={styles.menuItemDanger}
                  onClick={() => openDelete(comment.id)}
                >
                  <Trash2 aria-hidden />
                  삭제하기
                </button>
              </li>
            )}
            {!mine && (
              <li>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => report.open(reportTargetId('COMMENT', comment.id))}
                >
                  <Flag aria-hidden />
                  신고하기
                </button>
              </li>
            )}
          </ul>
        )}
      </OverlaySheet>

      {/* Shares `delete-confirm` with the post delete; only the `comment:` ids are ours */}
      <ConfirmDialog
        overlay={{ ...deleteDialog, isOpen: deleteDialog.isOpen && deleting !== undefined }}
        title="댓글을 삭제할까요?"
        description={
          deleting && hasReplies(deleting)
            ? "답글은 남고 이 댓글은 '삭제된 댓글입니다'로 보여요."
            : '삭제한 댓글은 되돌릴 수 없어요.'
        }
        confirmLabel="삭제"
        destructive
        pending={removePending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
