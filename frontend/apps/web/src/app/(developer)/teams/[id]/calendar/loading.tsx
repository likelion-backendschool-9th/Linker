import { PageFrame } from '@/components/layout/page-frame';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';

export default function CalendarLoading() {
  return (
    <PageFrame title="캘린더">
      <LoadingIndicator label="캘린더를 불러오고 있어요." variant="block">
        <Skeleton count={2} />
      </LoadingIndicator>
    </PageFrame>
  );
}
