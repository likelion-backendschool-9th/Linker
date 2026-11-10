'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { reportTargetId } from '@/features/report/report-target';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { POST } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import {
  commentsOptions,
  deleteComment,
  postKeys,
  updateComment,
  writeComment,
  type PostComment,
  type PostDetail,
} from '../../_lib/post-detail-queries';

/**
 * Why a write failed. The server sends the 04 copy for its limits: "잠시 후 다시 시도해 주세요." for
 * 10/min, "오늘은 더 할 수 없어요. 내일 다시 시도해 주세요." for 300/day (ch. 2, ch. 12).
 */
function writeErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status < 500) return error.message;
  return '댓글을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

/** Same checks as the composer, so edit and write fail the same way before the request */
function textError(count: number) {
  if (count === 0) return '댓글을 입력해 주세요.';
  if (count > POST.commentMax) return `댓글은 ${POST.commentMax}자까지 쓸 수 있어요.`;
  return null;
}

const DELETE_PREFIX = 'comment-';

function useRefreshComments(post: PostDetail) {
  const viewer = useViewer();
  const client = useQueryClient();
  const postId = String(post.id);
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: postKeys.comments(postId) }),
      client.invalidateQueries({ queryKey: postKeys.detail(viewer.login, postId) }),
    ]);
}

export function useCommentSection(post: PostDetail) {
  const id = useId();
  const comments = useQuery(commentsOptions(String(post.id)));
  return { titleId: `${id}-title`, comments, items: comments.data?.items ?? [] };
}

export function useCommentComposer(post: PostDetail) {
  const id = useId();
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const client = useQueryClient();
  const postId = String(post.id);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const count = countChars(text);

  const write = useMutation({
    mutationFn: () => writeComment(postId, { text: normalizeLineBreaks(text.trim()) }),
    // The line under the field shows the server's limit copy; no shared toast on top
    meta: { handledCodes: ['RATE_LIMITED'] },
    onSuccess: async () => {
      setText('');
      await Promise.all([
        client.invalidateQueries({ queryKey: postKeys.comments(postId) }),
        client.invalidateQueries({ queryKey: postKeys.detail(viewer.login, postId) }),
      ]);
    },
    onError: (failure) => setError(writeErrorMessage(failure)),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (write.isPending) return;
    const invalid = textError(count);
    if (invalid) return setError(invalid);
    setError(null);
    write.mutate();
  };

  return {
    id,
    isGuest: viewer.role === 'guest',
    promptLogin: () => requireLogin(),
    text,
    setText,
    error,
    writePending: write.isPending,
    submit,
  };
}

/**
 * Comment "더보기" (07 TODO 23, POL-P-5): my comment → edit / delete; on my post → delete others';
 * someone else's → report. Guests get the login prompt instead of the menu.
 */
export function useCommentItem(post: PostDetail, comment: PostComment) {
  const id = useId();
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const report = useOverlay('report');
  const deleteDialog = useOverlay('delete-confirm');
  const refresh = useRefreshComments(post);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.text);
  const [error, setError] = useState<string | null>(null);
  const mine = viewer.login !== null && viewer.login === comment.author.login;

  const edit = useMutation({
    mutationFn: () =>
      updateComment(String(post.id), comment.id, { text: normalizeLineBreaks(text.trim()) }),
    onSuccess: async () => {
      setEditing(false);
      await refresh();
    },
    onError: (failure) => setError(writeErrorMessage(failure)),
  });

  return {
    id,
    isGuest: viewer.role === 'guest',
    promptLogin: () => requireLogin(),
    canEdit: mine,
    // The post owner may delete others' comments but not edit them
    canDelete: mine || post.isAuthor,
    canReport: !mine,
    editing,
    startEdit: () => {
      setText(comment.text);
      setError(null);
      setEditing(true);
    },
    cancelEdit: () => setEditing(false),
    text,
    setText,
    error,
    savePending: edit.isPending,
    save: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (edit.isPending) return;
      const invalid = textError(countChars(text));
      if (invalid) return setError(invalid);
      setError(null);
      edit.mutate();
    },
    openDelete: () => deleteDialog.open(`${DELETE_PREFIX}${comment.id}`),
    openReport: () => report.open(reportTargetId('COMMENT', comment.id)),
  };
}

/** One confirm for the whole list; `oid` names the comment (`comment-12`) */
export function useCommentDeleteDialog(post: PostDetail) {
  const deleteDialog = useOverlay('delete-confirm');
  const refresh = useRefreshComments(post);
  const target = deleteDialog.id?.startsWith(DELETE_PREFIX)
    ? Number(deleteDialog.id.slice(DELETE_PREFIX.length))
    : null;

  const remove = useMutation({
    mutationFn: (commentId: number) => deleteComment(String(post.id), commentId),
    onSuccess: async () => {
      toast('댓글을 삭제했어요.');
      await deleteDialog.closeAnd(refresh);
    },
  });

  return {
    overlay: { ...deleteDialog, isOpen: deleteDialog.isOpen && target !== null },
    removePending: remove.isPending,
    error: remove.isError ? writeErrorMessage(remove.error) : null,
    confirmDelete: () => {
      if (target !== null && Number.isInteger(target) && !remove.isPending) remove.mutate(target);
    },
  };
}
