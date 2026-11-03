import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

import type { RecruiterAd } from '../../_components/recruiter-ad-card/ad-api';

/** Provisional WBS 24 PostController (feed) contract; replace with Orval types when OpenAPI is available. */
export type FeedPost = {
  id: number;
  author: {
    id: number;
    login: string;
    name: string;
    avatarUrl: string;
    /** Only SEEKING shows a badge to everyone (POL-H-4) */
    jobStatus: 'SEEKING' | 'OPEN' | 'OFF';
  };
  intro: string;
  /** null → the repo card stands in for the cover */
  coverUrl: string | null;
  repoFullName: string;
  language: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

/** Blueprint ch. 15: posts and (logged-in developers only) job ads in one list */
export type FeedItem =
  { type: 'POST'; post: FeedPost; whyShown: string | null } | ({ type: 'AD' } & RecruiterAd);

export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

export type RecommendedUser = {
  user: { id: number; login: string; name: string; avatarUrl: string };
  techStack: string[];
};

export const feedKeys = {
  // Per account: guests, developers and recruiters get different mixes
  feed: (login: string | null, offersOnly: boolean) => ['feed', login, offersOnly] as const,
  recommended: (login: string | null) => ['feed', login, 'recommended-users'] as const,
};

/** Guests: popular this week + newest; logged in: following + recommendations (POL-P-4) */
export function feedOptions(login: string | null, offersOnly: boolean) {
  return infiniteQueryOptions({
    queryKey: feedKeys.feed(login, offersOnly),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams();
      if (pageParam) query.set('cursor', pageParam);
      if (offersOnly) query.set('offersOnly', 'true');
      return apiFetch<FeedPage>(`/api/v1/public/feed${query.size ? `?${query}` : ''}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Empty feed right after sign-up: 5 developers by my tech stack (04 ch. 4 exceptions) */
export function recommendedUsersOptions(login: string | null) {
  return queryOptions({
    queryKey: feedKeys.recommended(login),
    queryFn: ({ signal }) =>
      apiFetch<{ items: RecommendedUser[] }>('/api/v1/user/feed/recommended-users', { signal }),
  });
}

/** Posts shown on screen, so recommendations skip them; logged-in members only */
export function sendSeen(postIds: number[]) {
  return apiFetch<void>('/api/v1/user/feed/seen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postIds }),
  });
}

/** Borrowed from 04 */
export function setFollow(login: string, follow: boolean) {
  return apiFetch<void>(`/api/v1/user/users/${encodeURIComponent(login)}/follow`, {
    method: follow ? 'POST' : 'DELETE',
  });
}
