import { PageFrame } from '@/components/layout/page-frame';
import { Skeleton } from '@/components/ui/skeleton';

export default function FeedLoading() {
  return (
    <PageFrame title="홈" hideTitle>
      <div aria-busy="true">
        <p role="status">피드를 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    </PageFrame>
  );
}
