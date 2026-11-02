import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageFrame title="내 통계" variant="stack" backHref="/workspace" bottomTabs>
      <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
        <Skeleton variant="card" count={3} />
      </LoadingIndicator>
    </PageFrame>
  );
}
