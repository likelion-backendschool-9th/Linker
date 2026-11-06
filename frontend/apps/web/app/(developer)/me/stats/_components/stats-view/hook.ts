'use client';

import { useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryState } from 'nuqs';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { postStatsOptions, recruiterViewsOptions, statsSummaryOptions } from './api';

export const SOURCES: Record<string, string> = {
  FEED: '피드',
  PROFILE: '프로필',
  RECRUIT_POST: '모집 글',
  CHAT_SHARE: '채팅 공유',
  EXTERNAL: '외부 링크',
  EXTERNAL_LINK: '외부 링크',
};

export function useStatsView() {
  const viewer = useViewer();
  const featured = useOverlay('stats-featured');
  const summary = useQuery(statsSummaryOptions(viewer.login));
  const posts = useQuery({
    ...postStatsOptions(viewer.login),
    enabled: summary.data?.isPro === true && !summary.isFetching,
  });
  const recruiters = useQuery({
    ...recruiterViewsOptions(viewer.login),
    enabled: summary.data?.isPro === true && !summary.isFetching,
  });
  const [postId, setPost] = useQueryState('post', parseAsString);

  const selected =
    summary.data?.items.find((p) => String(p.postId) === postId) ?? summary.data?.items[0];
  const totals = (summary.data?.items ?? []).reduce(
    (acc, p) => ({
      likes: acc.likes + p.likeCount,
      comments: acc.comments + p.commentCount,
      views: acc.views + p.viewCount,
    }),
    { likes: 0, comments: 0, views: 0 },
  );
  const detail = posts.data?.items.find((p) => p.postId === selected?.postId);

  return {
    viewer,
    featured,
    summary,
    posts,
    recruiters,
    selected,
    totals,
    detail,
    setPost,
  };
}
