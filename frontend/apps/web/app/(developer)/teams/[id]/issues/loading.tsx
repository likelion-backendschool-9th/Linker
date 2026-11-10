import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import {
  IssueListLoadingActions,
  IssueListPageSkeleton,
} from './_components/issue-list-page-skeleton/IssueListPageSkeleton';

/** Figma 982:865 "11-스켈레톤" — stack header, team tabs, progress card bones. */
export default function IssueListLoading() {
  return (
    <PageFrame
      title="이슈"
      variant="stack"
      backHref="/workspace"
      actions={<IssueListLoadingActions />}
    >
      <IssueListPageSkeleton />
    </PageFrame>
  );
}
