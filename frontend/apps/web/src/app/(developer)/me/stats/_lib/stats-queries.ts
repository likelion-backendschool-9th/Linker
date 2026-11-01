import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';
import { STATS } from '@/lib/policy';

export type StatsSummary = {
  items: {
    postId: number;
    intro: string;
    likeCount: number;
    commentCount: number;
    viewCount: number;
  }[];
  isPro: boolean;
};
export type PostStats = {
  items: {
    postId: number;
    intro: string;
    bySource: { source: string; count: number }[];
    readmeExpands: number;
    trend: { date: string; views: number }[];
  }[];
};
export type RecruiterViews = { thisWeek: number; weeks: { weekStart: string; count: number }[] };
const staleTime = 60 * 60 * 1000;

export function statsSummaryOptions(login: string | null) {
  return queryOptions({
    queryKey: ['stats', login, 'summary'],
    queryFn: ({ signal }) => apiFetch<StatsSummary>('/api/v1/user/me/stats/summary', { signal }),
    staleTime,
  });
}
export function postStatsOptions(login: string | null) {
  return queryOptions({
    queryKey: ['stats', login, 'posts', STATS.trendDays],
    queryFn: ({ signal }) =>
      apiFetch<PostStats>(`/api/v1/user/me/stats/posts?days=${STATS.trendDays}`, { signal }),
    staleTime,
  });
}
export function recruiterViewsOptions(login: string | null) {
  return queryOptions({
    queryKey: ['stats', login, 'recruiter-views', STATS.recruiterWeeks],
    queryFn: ({ signal }) =>
      apiFetch<RecruiterViews>(
        `/api/v1/user/me/stats/recruiter-views?weeks=${STATS.recruiterWeeks}`,
        { signal },
      ),
    staleTime,
  });
}
