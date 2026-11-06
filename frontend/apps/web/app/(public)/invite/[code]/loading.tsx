import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function Loading() {
  return (
    <PageFrame title="팀 초대">
      <Skeleton variant="card" />
    </PageFrame>
  );
}
