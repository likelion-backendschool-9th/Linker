import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function Loading() {
  return (
    <PageFrame title="내 통계" variant="stack" backHref="/workspace" bottomTabs>
      <Skeleton variant="card" count={3} />
    </PageFrame>
  );
}
