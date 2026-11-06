import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
export default function SubscribeLoading() {
  return (
    <PageFrame title="요금제" variant="stack" backHref="/feed">
      <div aria-busy="true">
        <p role="status">요금제를 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    </PageFrame>
  );
}
