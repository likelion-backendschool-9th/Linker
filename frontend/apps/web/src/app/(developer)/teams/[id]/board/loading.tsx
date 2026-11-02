import { PageFrame } from '@/components/layout/page-frame';
import { Skeleton } from '@/components/ui/skeleton';

export default function BoardLoading() {
  return (
    <PageFrame title="상태 보드">
      <div aria-busy="true">
        <p role="status">보드를 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    </PageFrame>
  );
}
