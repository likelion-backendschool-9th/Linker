import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function CalendarLoading() {
  return (
    <PageFrame title="캘린더">
      <div aria-busy="true">
        <p role="status">캘린더를 불러오고 있어요.</p>
        <Skeleton count={2} />
      </div>
    </PageFrame>
  );
}
