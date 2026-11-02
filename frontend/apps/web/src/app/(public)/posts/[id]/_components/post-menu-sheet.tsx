'use client';

// Overlay: post "더보기" — author: edit (22) / delete; others: report (00)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Pencil, Trash2 } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog';
import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { reportTargetId } from '@/features/report/report-target';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { deletePost, type PostDetail } from '../_lib/post-detail-queries';
import styles from './post-detail.module.css';

const DELETE_ID = 'post';

export function PostMenuSheet({ post }: { post: PostDetail }) {
  const router = useRouter();
  const client = useQueryClient();
  const menu = useOverlay('post-menu');
  const deleteDialog = useOverlay('delete-confirm');
  const report = useOverlay('report');

  const remove = useMutation({
    mutationFn: () => deletePost(String(post.id)),
    onSuccess: async () => {
      toast('게시물을 삭제했어요.');
      await deleteDialog.closeAnd(() => router.replace('/feed'));
      await client.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  return (
    <>
      <OverlaySheet
        overlay={menu}
        title="게시물 더보기"
        description="이 게시물에 할 수 있는 일이에요."
        describeHidden
      >
        <ul className={styles.menu}>
          {post.isAuthor ? (
            <>
              <li>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => void menu.closeThen(`/posts/${post.id}/edit` as Route)}
                >
                  <Pencil aria-hidden />
                  수정하기
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={styles.menuItemDanger}
                  onClick={() => deleteDialog.open(DELETE_ID)}
                >
                  <Trash2 aria-hidden />
                  삭제하기
                </button>
              </li>
            </>
          ) : (
            <li>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => report.open(reportTargetId('POST', post.id))}
              >
                <Flag aria-hidden />
                신고하기
              </button>
            </li>
          )}
        </ul>
      </OverlaySheet>

      {post.isAuthor && (
        // Shares `delete-confirm` with the comment delete; only the `post` id is ours
        <ConfirmDialog
          overlay={{
            ...deleteDialog,
            isOpen: deleteDialog.isOpen && deleteDialog.id === DELETE_ID,
          }}
          title="게시물을 삭제할까요?"
          description="좋아요와 댓글도 함께 삭제돼요."
          confirmLabel="삭제"
          destructive
          pending={remove.isPending}
          onConfirm={() => {
            if (!remove.isPending) remove.mutate();
          }}
        />
      )}
    </>
  );
}
