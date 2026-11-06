'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent, type RefObject } from 'react';

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
} from '../../_lib/post-detail-queries';

/** Why a write failed, with the 04 ch. 12 copy */
function writeErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
    return '잠시 후 다시 시도해 주세요.';
  }
  if (error instanceof ApiError && error.status < 500) return error.message;
  return '댓글을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export function useCommentSection(post: PostDetail) {
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

  return {
    titleId: `${id}-title`,
    comments,
    items,
    threads,
    repliesOf,
    total,
    replyTo,
    editingId,
    composer,
    startReply,
    cancelReply: () => setReplyTo(null),
    clearReply: () => setReplyTo(null),
    clearEditing: () => setEditingId(null),
    startEdit: (commentId: number) => {
      setReplyTo(null);
      setEditingId(commentId);
    },
  };
}

export function useCommentItem(comment: PostComment) {
  const requireLogin = useRequireLogin();
  const menu = useOverlay('comment-menu');
  return {
    nameId: `comment-${comment.id}-author`,
    openMenu: () => {
      if (requireLogin()) menu.open(String(comment.id));
    },
  };
}

type UseCommentComposerArgs = {
  post: PostDetail;
  replyTo: PostComment | null;
  onDone: () => void;
};

export function useCommentComposer({ post, replyTo, onDone }: UseCommentComposerArgs) {
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (write.isPending) return;
    if (count === 0) return setError('댓글을 입력해 주세요.');
    if (count > POST.commentMax) return setError(`댓글은 ${POST.commentMax}자까지 쓸 수 있어요.`);
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
    count,
    max: POST.commentMax,
    writePending: write.isPending,
    submit,
  };
}

type UseCommentEditArgs = {
  post: PostDetail;
  comment: PostComment;
  onDone: () => void;
};

export function useCommentEdit({ post, comment, onDone }: UseCommentEditArgs) {
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (save.isPending) return;
    if (count === 0) return setError('댓글을 입력해 주세요.');
    if (count > POST.commentMax) return setError(`댓글은 ${POST.commentMax}자까지 쓸 수 있어요.`);
    save.mutate();
  };

  return {
    id,
    text,
    setText,
    error,
    count,
    max: POST.commentMax,
    savePending: save.isPending,
    submit,
  };
}

export type CommentComposerRef = RefObject<HTMLTextAreaElement | null>;
