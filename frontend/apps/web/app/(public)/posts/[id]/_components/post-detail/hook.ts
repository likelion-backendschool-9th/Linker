'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  postDetailOptions,
  postKeys,
  sameRepoOptions,
  setLike,
  type PostDetail as Detail,
} from '../../_lib/post-detail-queries';

export function usePostDetail(postId: string) {
  const viewer = useViewer();
  const detail = useQuery(postDetailOptions(viewer.login, postId));
  const recruiter = viewer.role === 'recruiter';
  const post = detail.data;
  const underReview = post?.visibility === 'UNDER_REVIEW';
  // Hidden posts block likes and comments (04 ch. 4 exceptions); recruiters only read
  const canReact = Boolean(post && !recruiter && !underReview);

  return { viewer, detail, post, underReview: Boolean(underReview), canReact };
}

export function useAuthorRow() {
  const requireLogin = useRequireLogin();
  const menu = useOverlay('post-menu');
  return {
    openMenu: () => {
      if (requireLogin()) menu.open();
    },
  };
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
      toast('좋아요를 반영하지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'alert' });
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

export function useSameRepoPosts(postId: string) {
  const posts = useQuery(sameRepoOptions(postId));
  return posts.data?.items ?? [];
}
