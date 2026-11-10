'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  postDetailOptions,
  postKeys,
  setFollow,
  setLike,
  type PostDetail as Detail,
} from '../../_lib/post-detail-queries';

export function usePostDetail(postId: string) {
  const viewer = useViewer();
  const detail = useQuery(postDetailOptions(viewer.login, postId));
  const recruiter = viewer.role === 'recruiter';
  const post = detail.data;
  // Only the author gets a hidden post: auto-hidden (UNDER_REVIEW) or by an operator (HIDDEN)
  const underReview = Boolean(post && post.visibility !== 'VISIBLE');
  // Hidden posts block likes and comments (04 ch. 4 exceptions); recruiters only read
  const canReact = Boolean(post && !recruiter && !underReview);

  return { viewer, detail, post, underReview: Boolean(underReview), canReact };
}

export function useReactionBar(post: Detail, canReact: boolean) {
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const client = useQueryClient();
  const likers = useOverlay('post-likers');
  const postId = String(post.id);
  const key = postKeys.detail(viewer.login, postId);

  const like = useMutation({
    mutationFn: (next: boolean) => setLike(postId, next),
    onMutate: async (next) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Detail>(key);
      client.setQueryData<Detail>(key, (current) =>
        current
          ? { ...current, likedByMe: next, likeCount: current.likeCount + (next ? 1 : -1) }
          : current,
      );
      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
      toast('좋아요를 반영하지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'error' });
    },
    onSuccess: ({ likeCount }) =>
      client.setQueryData<Detail>(key, (current) =>
        current ? { ...current, likeCount } : current,
      ),
  });

  return {
    canReact,
    likedByMe: post.likedByMe,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    toggleLike: () => {
      if (requireLogin() && !like.isPending) like.mutate(!post.likedByMe);
    },
    openLikers: () => {
      if (requireLogin()) likers.open();
    },
  };
}

/**
 * Author row "팔로우" (borrowed from 04): applied at once and rolled back on failure. Guests get the
 * login prompt; recruiters can't follow and the author doesn't follow themselves, so neither sees it.
 */
export function useFollowAuthor(post: Detail) {
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const client = useQueryClient();
  const key = postKeys.detail(viewer.login, String(post.id));
  const following = post.author.isFollowing === true;

  const follow = useMutation({
    mutationFn: (next: boolean) => setFollow(post.author.login, next),
    // Its own toast below covers the 200/day limit too
    meta: { handledCodes: ['RATE_LIMITED'] },
    onMutate: async (next) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Detail>(key);
      client.setQueryData<Detail>(key, (current) =>
        current ? { ...current, author: { ...current.author, isFollowing: next } } : current,
      );
      return { previous };
    },
    onError: (error, _next, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
      toast(error instanceof ApiError ? error.message : '팔로우 상태를 바꾸지 못했어요.', {
        tone: 'error',
      });
    },
  });

  return {
    visible: !post.isAuthor && viewer.role !== 'recruiter',
    following,
    pending: follow.isPending,
    toggle: () => {
      if (requireLogin() && !follow.isPending) follow.mutate(!following);
    },
  };
}
