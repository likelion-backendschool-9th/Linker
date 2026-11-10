'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent } from 'react';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { countChars, normalizeLineBreaks } from '@/lib/format/text';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { POST } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import { patchCards } from '../../_lib/feed-cache';
import { commentsOptions, postKeys, writeComment } from './api';

/**
 * Why a write failed (same as 23). The server sends the 04 copy for its limits: "잠시 후 다시 시도해
 * 주세요." for 10/min, "오늘은 더 할 수 없어요. 내일 다시 시도해 주세요." for 300/day (ch. 2, ch. 12).
 */
function writeErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status < 500) return error.message;
  return '댓글을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

/** One sheet for the whole feed; `?overlay=feed-comments&oid={postId}` says which post */
export function useCommentSheet() {
  const overlay = useOverlay('feed-comments');
  const postId = overlay.id;
  const comments = useQuery({
    ...commentsOptions(postId ?? ''),
    enabled: postId !== null,
  });
  return { overlay, postId, comments, items: comments.data?.items ?? [] };
}

/**
 * Bottom composer. Guests get the login sheet when they touch it; recruiters only read (04 ch. 2).
 * After a write the list refetches, the card's count goes up, and the list scrolls to the end.
 */
export function useCommentComposer(postId: string, onWritten: () => void) {
  const id = useId();
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const client = useQueryClient();
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const write = useMutation({
    mutationFn: () => writeComment(postId, { text: normalizeLineBreaks(text.trim()) }),
    // The toast below shows the server's limit copy; no shared toast on top
    meta: { handledCodes: ['RATE_LIMITED'] },
    onSuccess: async () => {
      setText('');
      patchCards(client, Number(postId), (post) => ({
        ...post,
        commentCount: post.commentCount + 1,
      }));
      await Promise.all([
        client.invalidateQueries({ queryKey: postKeys.comments(postId) }),
        client.invalidateQueries({ queryKey: postKeys.detail(viewer.login, postId) }),
      ]);
      onWritten();
    },
    onError: (failure) => toast(writeErrorMessage(failure), { tone: 'error' }),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Radix portals the sheet, but React still bubbles submit to any page form around it
    event.stopPropagation();
    if (!requireLogin() || write.isPending) return;
    const count = countChars(text);
    if (count === 0) {
      toast('댓글을 입력해 주세요.', { tone: 'error' });
      input.current?.focus();
      return;
    }
    if (count > POST.commentMax) {
      toast(`댓글은 ${POST.commentMax}자까지 쓸 수 있어요.`, { tone: 'error' });
      return;
    }
    write.mutate();
  };

  return {
    inputId: `${id}-input`,
    input,
    canWrite: viewer.role !== 'recruiter',
    isGuest: viewer.role === 'guest',
    promptLogin: () => requireLogin(),
    text,
    setText,
    pending: write.isPending,
    submit,
  };
}
