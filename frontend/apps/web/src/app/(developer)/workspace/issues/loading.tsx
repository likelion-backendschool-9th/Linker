import type { Route } from 'next';

import { PageFrame } from '@/components/layout/page-frame';
import { Skeleton } from '@/components/ui/skeleton';

// 07 workspace home (B); typed once that route exists
const WORKSPACE_HOME = '/workspace' as Route;

export default function MyIssuesLoading() {
  return (
    <PageFrame title="내 이슈" variant="stack" backHref={WORKSPACE_HOME}>
      <div aria-busy="true">
        <p role="status">내 이슈를 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    </PageFrame>
  );
}
