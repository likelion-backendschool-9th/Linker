import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

export default function NotificationsLoading() {
  return (
    <PageFrame title="알림" variant="stack" backHref="/feed">
      <div aria-busy="true">
        <p role="status">알림을 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    </PageFrame>
  );
}
