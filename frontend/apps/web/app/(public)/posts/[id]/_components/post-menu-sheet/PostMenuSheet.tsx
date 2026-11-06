'use client';

// Overlay: post "더보기" — author: edit (22) / delete; others: report (00)
import { Flag, Pencil, Trash2 } from 'lucide-react';
import type { Route } from 'next';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';

import type { PostDetail } from '../../_lib/post-detail-queries';
import styles from '../post-detail/PostDetail.module.css';
import { usePostMenuSheet } from './hook';

export function PostMenuSheet({ post }: { post: PostDetail }) {
  const {
    menu,
    deleteDialog,
    deleteId,
    removePending,
    openDelete,
    confirmDelete,
    openReport,
  } = usePostMenuSheet(post);

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
                <button type="button" className={styles.menuItemDanger} onClick={openDelete}>
                  <Trash2 aria-hidden />
                  삭제하기
                </button>
              </li>
            </>
          ) : (
            <li>
              <button type="button" className={styles.menuItem} onClick={openReport}>
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
            isOpen: deleteDialog.isOpen && deleteDialog.id === deleteId,
          }}
          title="게시물을 삭제할까요?"
          description="좋아요와 댓글도 함께 삭제돼요."
          confirmLabel="삭제"
          destructive
          pending={removePending}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}
