import { PageFrame } from '@/components/layout/page-frame';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecruitsLoading() {
  return (
    <PageFrame title="팀 찾기">
      <div aria-busy="true">
        <p role="status">모집 글을 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    </PageFrame>
  );
}
