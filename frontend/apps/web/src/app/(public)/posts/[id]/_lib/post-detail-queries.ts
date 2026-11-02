import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

/** Provisional WBS 23 `PostDetailController` contract; replace with Orval types when OpenAPI is available. */
export type PostAuthor = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
  /** Only SEEKING is shown to everyone (04 ch. 3 POL-H-4) */
  jobStatus: 'SEEKING' | 'OPEN' | 'OFF';
};

export type PostDetail = {
  id: number;
  author: PostAuthor;
  intro: string;
  body: string;
  repo: {
    fullName: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    isFork: boolean;
    /** PRIVATE_OR_DELETED → "레포를 볼 수 없음", README hidden (POL-P-1) */
    state: 'PUBLIC' | 'PRIVATE_OR_DELETED';
    authorCommitCount: number;
    handledIssueCount: number;
  };
  /** In order; the first is the cover */
  photos: string[];
  myRole: string | null;
  demoLinks: string[];
  period: { start: string; end: string | null } | null;
  teamSize: number | null;
  tags: string[];
  likeCount: number;
  commentCount: number;
  /** Hidden by reports: only the author gets it, as UNDER_REVIEW */
  visibility: 'VISIBLE' | 'UNDER_REVIEW';
  createdAt: string;
  editedAt: string | null;
  isAuthor: boolean;
  likedByMe: boolean;
  /** Recruiter viewing a Seeking / Open-to-offers author (after 31) */
  canSendOffer: boolean;
};

export type PostComment = {
  id: number;
  parentId: number | null;
  author: Pick<PostAuthor, 'id' | 'login' | 'name' | 'avatarUrl'>;
  /** "삭제된 댓글입니다" when deleted but kept for its replies */
  text: string | null;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
};

export type SamePostCard = {
  id: number;
  intro: string;
  author: PostAuthor;
  coverUrl: string | null;
};

const encode = (postId: string) => encodeURIComponent(postId);

export const postKeys = {
  // Under ['posts', login] so 22's writes (invalidate ['posts']) refresh it too
  detail: (login: string | null, postId: string) => ['posts', login, 'detail', postId] as const,
  comments: (postId: string) => ['posts', 'comments', postId] as const,
  readme: (postId: string) => ['posts', 'readme', postId] as const,
  likers: (login: string | null, postId: string) => ['posts', login, 'likers', postId] as const,
  sameRepo: (postId: string) => ['posts', 'same-repo', postId] as const,
};

/**
 * Public read; with a cookie it adds my like and logs the view. `from` (feed, profile, recruit, chat,
 * share) is only the traffic source for that log, so it stays out of the key.
 */
export function postDetailOptions(
  login: string | null,
  postId: string,
  from: string | null = null,
) {
  return queryOptions({
    queryKey: postKeys.detail(login, postId),
    queryFn: ({ signal }) =>
      apiFetch<PostDetail>(
        `/api/v1/public/posts/${encode(postId)}${from ? `?from=${encodeURIComponent(from)}` : ''}`,
        { signal },
      ),
  });
}

export function commentsOptions(postId: string) {
  return queryOptions({
    queryKey: postKeys.comments(postId),
    queryFn: ({ signal }) =>
      apiFetch<{ items: PostComment[] }>(`/api/v1/public/posts/${encode(postId)}/comments`, {
        signal,
      }),
  });
}

/** `[Included]` README: cached 1 hour and sanitized by the server (POL-P-3) */
export function readmeOptions(postId: string) {
  return queryOptions({
    queryKey: postKeys.readme(postId),
    staleTime: 60 * 60_000,
    queryFn: ({ signal }) =>
      apiFetch<{ markdown: string }>(`/api/v1/public/posts/${encode(postId)}/readme`, { signal }),
  });
}

/** People list, so login only (POL-A-9) */
export function likersOptions(login: string | null, postId: string) {
  return queryOptions({
    queryKey: postKeys.likers(login, postId),
    queryFn: ({ signal }) =>
      apiFetch<{ items: { user: Pick<PostAuthor, 'id' | 'login' | 'name' | 'avatarUrl'> }[] }>(
        `/api/v1/user/posts/${encode(postId)}/likes`,
        { signal },
      ),
  });
}

export function sameRepoOptions(postId: string) {
  return queryOptions({
    queryKey: postKeys.sameRepo(postId),
    queryFn: ({ signal }) =>
      apiFetch<{ items: SamePostCard[] }>(
        `/api/v1/public/posts/${encode(postId)}/same-repo-posts`,
        {
          signal,
        },
      ),
  });
}

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function setLike(postId: string, like: boolean) {
  return apiFetch<{ likeCount: number }>(`/api/v1/user/posts/${encode(postId)}/likes`, {
    method: like ? 'POST' : 'DELETE',
  });
}

/** 500 chars, 10/min and 300/day; `parentId` = reply to a top-level comment (one level) */
export function writeComment(postId: string, body: { text: string; parentId: number | null }) {
  return apiFetch<PostComment>(`/api/v1/user/posts/${encode(postId)}/comments`, {
    method: 'POST',
    ...json(body),
  });
}

export function editComment(postId: string, commentId: number, text: string) {
  return apiFetch<PostComment>(`/api/v1/user/posts/${encode(postId)}/comments/${commentId}`, {
    method: 'PATCH',
    ...json({ text }),
  });
}

/** Comment author or post owner; with replies it stays as "삭제된 댓글입니다" (POL-P-5) */
export function deleteComment(postId: string, commentId: number) {
  return apiFetch<void>(`/api/v1/user/posts/${encode(postId)}/comments/${commentId}`, {
    method: 'DELETE',
  });
}

/** Likes and comments go with it (POL-P-2) */
export function deletePost(postId: string) {
  return apiFetch<void>(`/api/v1/user/posts/${encode(postId)}`, { method: 'DELETE' });
}
