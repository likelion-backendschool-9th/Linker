import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageFrame title="팀 초대">
      <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
        <Skeleton variant="card" />
      </LoadingIndicator>
    </PageFrame>
  );
}
