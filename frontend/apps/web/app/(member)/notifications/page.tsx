import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import {
  notificationCountOptions,
  notificationListOptions,
} from '@/features/notifications/notification-queries';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { NotificationList } from './_components/notification-list/NotificationList';
import { loadNotificationTab } from './_lib/notification-tab';

export const metadata = buildMetadata({ title: '알림', path: '/notifications' });

export default async function NotificationsPage({ searchParams }: PageProps<'/notifications'>) {
  const [session, { tab }] = await Promise.all([getSession(), loadNotificationTab(searchParams)]);
  const login = session?.login ?? null;
  const client = getQueryClient();
  await Promise.all([
    client.prefetchInfiniteQuery(notificationListOptions(login, tab)),
    client.prefetchQuery(notificationCountOptions(login)),
  ]);
  return (
    <PageFrame title="알림" variant="stack" backHref="/feed">
      <HydrationBoundary state={dehydrate(client)}>
        <NotificationList />
      </HydrationBoundary>
    </PageFrame>
  );
}
