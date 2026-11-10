import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import { FeedListPageSkeleton } from './_components/feed-list-page-skeleton/FeedListPageSkeleton';

/** Figma 999:1219 "24-스켈레톤" — app chrome, feed tabs, card bones, write FAB. */
export default function FeedLoading() {
  return (
    <PageFrame title="홈" hideTitle>
      <FeedListPageSkeleton />
    </PageFrame>
  );
}
