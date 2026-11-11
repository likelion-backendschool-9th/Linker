import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import {
  IssueDetailLoadingActions,
  IssueDetailPageSkeleton,
} from './_components/issue-detail-page-skeleton/IssueDetailPageSkeleton';

/** Figma 982:1171 "12-스켈레톤" — stack header, title/meta bones, info-card value bones. */
export default function IssueDetailLoading() {
  return (
    <PageFrame
      title="이슈 상세"
      variant="stack"
      backHref="/workspace"
      actions={<IssueDetailLoadingActions />}
    >
      <IssueDetailPageSkeleton />
    </PageFrame>
  );
}
