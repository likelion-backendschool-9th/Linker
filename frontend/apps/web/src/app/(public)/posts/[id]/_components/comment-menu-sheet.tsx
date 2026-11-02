'use client';

// Overlay: comment "더보기" — mine: edit / delete; post owner: delete; others: report (POL-P-5)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Pencil, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog';
import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { reportTargetId } from '@/features/report/report-target';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  deleteComment,
  postKeys,
  type PostComment,
  type PostDetail,
} from '../_lib/post-detail-queries';
import styles from './post-detail.module.css';

type CommentMenuSheetProps = {
  post: PostDetail;
  comments: PostComment[];
  onEdit: (commentId: number) => void;
};

const DELETE_PREFIX = 'comment:';

export function CommentMenuSheet({ post, comments, onEdit }: CommentMenuSheetProps) {
  const viewer = useViewer();
  const client = useQueryClient();
  const menu = useOverlay('comment-menu');
  const deleteDialog = useOverlay('delete-confirm');
  const report = useOverlay('report');
  const postId = String(post.id);
  const comment = comments.find((item) => String(item.id) === menu.id);
  const mine = comment !== undefined && comment.author.login === viewer.login;
  const deleting = deleteDialog.id?.startsWith(DELETE_PREFIX)
    ? comments.find((item) => `${DELETE_PREFIX}${item.id}` === deleteDialog.id)
    : undefined;

  const remove = useMutation({
    mutationFn: (commentId: number) => deleteComment(postId, commentId),
    onSuccess: async () => {
      deleteDialog.close();
      toast('댓글을 삭제했어요.');
      await Promise.all([
        client.invalidateQueries({ queryKey: postKeys.comments(postId) }),
        client.invalidateQueries({ queryKey: postKeys.detail(viewer.login, postId) }),
      ]);
    },
  });
  const hasReplies = (target: PostComment) => comments.some((item) => item.parentId === target.id);

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
            {(mine || post.isAuthor) && (
              <li>
                {/* Opening another overlay replaces this one in the URL (blueprint ch. 7) */}
                <button
                  type="button"
                  className={styles.menuItemDanger}
                  onClick={() => deleteDialog.open(`${DELETE_PREFIX}${comment.id}`)}
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
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting && !remove.isPending) remove.mutate(deleting.id);
        }}
      />
    </>
  );
}
