import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function Loading() {
  return (
    <PageFrame title="워크스페이스">
      <Skeleton variant="card" count={3} />
    </PageFrame>
  );
}
