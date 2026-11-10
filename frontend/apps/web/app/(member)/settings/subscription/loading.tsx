import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import { SubscriptionPageSkeleton } from './_components/subscription-page-skeleton/SubscriptionPageSkeleton';

/** Figma 999:1350 "29-스켈레톤" — stack header, plan card + info-row bones. */
export default function SubscriptionLoading() {
  return (
    <PageFrame title="구독 관리" variant="stack" backHref="/settings">
      <SubscriptionPageSkeleton />
    </PageFrame>
  );
}
