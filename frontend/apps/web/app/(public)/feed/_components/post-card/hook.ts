'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { useViewer } from '@/lib/auth/viewer-context';
import { toast } from '@/stores/toast-store';

import { isCardQuery, patchCards } from '../../_lib/feed-cache';
import type { FeedPost } from '../../_lib/feed-queries';
import { setLike } from './api';

/**
 * Heart toggle on the card, optimistic: the heart and count change at once, the server count wins
 * on success, and a failure puts every cached copy back. Guests get the login sheet first;
 * recruiters only read (04 ch. 2), so they get no button.
 */
export function usePostLike(post: FeedPost) {
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const client = useQueryClient();

  const like = useMutation({
    mutationFn: (next: boolean) => setLike(String(post.id), next),
    onMutate: async (next) => {
      await client.cancelQueries({ predicate: isCardQuery });
      const snapshot = client.getQueriesData({ predicate: isCardQuery });
      patchCards(client, post.id, (current) => ({
        ...current,
        likedByMe: next,
        likeCount: Math.max(0, current.likeCount + (next ? 1 : -1)),
      }));
      return { snapshot };
    },
    onError: (_error, _next, context) => {
      context?.snapshot.forEach(([key, data]) => client.setQueryData(key, data));
      toast('좋아요를 반영하지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'alert' });
    },
    onSuccess: ({ likeCount }) =>
      patchCards(client, post.id, (current) => ({ ...current, likeCount })),
    // 23 reads its own copy; let it refetch with the new like
    onSettled: () =>
      client.invalidateQueries({ queryKey: ['posts', viewer.login, 'detail', String(post.id)] }),
  });

  return {
    canLike: viewer.role !== 'recruiter',
    toggle: () => {
      if (requireLogin() && !like.isPending) like.mutate(!post.likedByMe);
    },
  };
}

const ELLIPSIS = '…';

/** `prefix…` without trailing spaces or punctuation, so a cut never reads "요.…" */
const cutAt = (chars: string[], count: number) =>
  chars
    .slice(0, count)
    .join('')
    .replace(/[\s.,!?·…]+$/u, '') + ELLIPSIS;

/**
 * Excerpt of at most `lines` lines (Figma 92:212). Fits → the whole text, no "더 보기".
 * Too long → the longest prefix where `prefix…` + " 더 보기" still fits, so the link never wraps
 * to another line.
 * Measured on a hidden copy of the paragraph at its real width, and again when the width changes.
 * `null` until measured (SSR and the first client pass show the whole text, clamped by CSS).
 */
export function useExcerptClamp(text: string, lines = 2) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [shown, setShown] = useState<string | null>(null);

  useLayoutEffect(() => {
    const paragraph = ref.current;
    if (!paragraph || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      const width = paragraph.clientWidth;
      if (width === 0) return;
      const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight);
      if (!lineHeight) return;
      const maxHeight = lineHeight * lines + 1;

      // Same classes and width, out of view; its first text node is swapped while searching
      const probe = paragraph.cloneNode(true) as HTMLParagraphElement;
      probe.removeAttribute('id');
      probe.setAttribute('aria-hidden', 'true');
      Object.assign(probe.style, {
        position: 'absolute',
        visibility: 'hidden',
        pointerEvents: 'none',
        width: `${width}px`,
        // The CSS fallback clamp would hide the overflow this search measures
        display: 'block',
        WebkitLineClamp: 'unset',
        maxHeight: 'none',
        overflow: 'visible',
      });
      const body = probe.querySelector<HTMLElement>('[data-excerpt-text]');
      const more = probe.querySelector<HTMLElement>('[data-excerpt-more]');
      if (!body || !more) return;
      paragraph.parentElement?.appendChild(probe);

      const fits = (value: string, withMore: boolean) => {
        body.textContent = value;
        more.hidden = !withMore;
        return probe.getBoundingClientRect().height <= maxHeight;
      };

      let next = text;
      // The whole text on its own decides whether "더 보기" appears at all
      if (!fits(text, false)) {
        const chars = Array.from(text);
        let low = 0;
        let high = chars.length - 1;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (fits(cutAt(chars, mid), true)) low = mid;
          else high = mid - 1;
        }
        next = cutAt(chars, low);
      }
      probe.remove();
      setShown((current) => (current === next ? current : next));
    };

    measure();
    let lastWidth = paragraph.clientWidth;
    const observer = new ResizeObserver(() => {
      if (paragraph.clientWidth === lastWidth) return;
      lastWidth = paragraph.clientWidth;
      measure();
    });
    observer.observe(paragraph);
    return () => observer.disconnect();
  }, [text, lines]);

  return { ref, shown, measured: shown !== null };
}
