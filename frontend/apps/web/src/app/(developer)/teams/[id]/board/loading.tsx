import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function BoardLoading() {
  return (
    <PageFrame title="상태 보드">
      <LoadingIndicator label="보드를 불러오고 있어요." variant="block">
        <Skeleton count={3} />
      </LoadingIndicator>
    </PageFrame>
  );
}
