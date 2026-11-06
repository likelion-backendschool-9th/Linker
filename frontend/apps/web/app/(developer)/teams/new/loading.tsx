import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function Loading() {
  return (
    <PageFrame title="팀 만들기" variant="stack" backHref="/workspace">
      <Skeleton variant="card" />
    </PageFrame>
  );
}
