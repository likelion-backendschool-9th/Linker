'use client';

// Overlay: delete confirm opened from the header dropdown (author only)
import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';

import type { PostDetail } from '../../_lib/post-detail-queries';
import { usePostDeleteDialog } from './hook';

export function PostMenuSheet({ post }: { post: PostDetail }) {
  const { overlay, removePending, confirmDelete } = usePostDeleteDialog(post);
  if (!post.isAuthor) return null;

  return (
    <ConfirmDialog
      overlay={overlay}
      title="게시물을 삭제할까요?"
      description="좋아요와 댓글도 함께 삭제돼요."
      confirmLabel="삭제"
      destructive
      pending={removePending}
      onConfirm={confirmDelete}
    />
  );
}
