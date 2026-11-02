import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
export default function SubscribeLoading() {
  return (
    <PageFrame title="요금제" variant="stack" backHref="/feed">
      <LoadingIndicator label="요금제를 불러오고 있어요." variant="block">
        <Skeleton count={3} />
      </LoadingIndicator>
    </PageFrame>
  );
}
