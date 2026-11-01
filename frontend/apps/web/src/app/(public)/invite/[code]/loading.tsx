import { PageFrame } from '@/components/layout/page-frame';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageFrame title="팀 초대">
      <Skeleton variant="card" />
    </PageFrame>
  );
}
