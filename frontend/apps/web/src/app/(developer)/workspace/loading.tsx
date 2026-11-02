import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageFrame title="워크스페이스">
      <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
        <Skeleton variant="card" count={3} />
      </LoadingIndicator>
    </PageFrame>
  );
}
