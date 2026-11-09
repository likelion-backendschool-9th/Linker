'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { POST } from '@/lib/policy';

import {
  commentsOptions,
  postKeys,
  writeComment,
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
    writePending: write.isPending,
    submit,
  };
}
