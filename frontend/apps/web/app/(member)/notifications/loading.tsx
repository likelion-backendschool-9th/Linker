import { PageFrame } from '@/components/layout/page-frame/PageFrame';

import { NotificationListPageSkeleton } from './_components/notification-list-page-skeleton/NotificationListPageSkeleton';

/** Figma 999:709 "18-스켈레톤" — stack header, tabs, 전체 읽기, day chrome, text bone. */
export default function NotificationsLoading() {
  return (
    <PageFrame title="알림" variant="stack" backHref="/feed">
      <NotificationListPageSkeleton />
    </PageFrame>
  );
}
