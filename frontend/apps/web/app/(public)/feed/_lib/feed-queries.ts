import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

import type { RecruiterAd } from '../../_components/recruiter-ad-card';

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
    /** Proposal beyond WBS: card shows "팔로잉" instead of "팔로우" (Figma 92:259); false for guests */
    isFollowing: boolean;
  };
  /** One-line title under the media (Figma 92:189) */
  intro: string;
  /** Body preview under the title; UI appends "더 보기" (Figma 92:212) */
  excerpt: string | null;
  /** null → the repo card stands in for the cover */
  coverUrl: string | null;
  repoFullName: string;
  language: string | null;
  likeCount: number;
  /** Proposal beyond WBS: filled red heart when I liked it (Figma 92:297); false for guests */
  likedByMe: boolean;
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

/** "추천" (everyone) / "팔로잉" (posts by people I follow; guests see a login notice instead) — Figma 785:1211 */
export const FEED_TABS = ['recommended', 'following'] as const;
export type FeedTab = (typeof FEED_TABS)[number];

export const feedKeys = {
  // Per account: guests, developers and recruiters get different mixes
  feed: (login: string | null, offersOnly: boolean, tab: FeedTab = 'recommended') =>
    ['feed', login, offersOnly, tab] as const,
  recommended: (login: string | null) => ['feed', login, 'recommended-users'] as const,
};

/**
 * "추천": developers/operators get tech stack and job category matches first, then the rest at
 * random; guests and recruiters get every post at random (POL-P-4). The cursor is opaque.
 * "팔로잉" (`tab=following`): posts by people I follow, newest first; `offersOnly` is 추천 only.
 */
export function feedOptions(
  login: string | null,
  offersOnly: boolean,
  tab: FeedTab = 'recommended',
) {
  const following = tab === 'following';
  return infiniteQueryOptions({
    queryKey: feedKeys.feed(login, following ? false : offersOnly, tab),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams();
      if (following) query.set('tab', 'following');
      if (pageParam) query.set('cursor', pageParam);
      if (offersOnly && !following) query.set('offersOnly', 'true');
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
  return apiFetch<void>(`/api/v1/user/user/${encodeURIComponent(login)}/follow`, {
    method: follow ? 'POST' : 'DELETE',
  });
}
