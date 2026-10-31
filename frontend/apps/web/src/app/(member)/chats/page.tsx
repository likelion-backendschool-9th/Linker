import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { PageFrame } from '@/components/layout/page-frame';
import { CHAT_TABS, chatRoomsOptions, unreadSummaryOptions } from '@/features/chat/chat-queries';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { ChatList } from './_components/chat-list';

export const metadata = buildMetadata({ title: '채팅', path: '/chats' });

export default async function ChatsPage({ searchParams }: PageProps<'/chats'>) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const tab =
    session?.userType === 'RECRUITER'
      ? 'DIRECT'
      : (CHAT_TABS.find((item) => item === params.tab) ?? 'TEAM');
  const login = session?.login ?? null;
  const client = getQueryClient();
  await Promise.all([
    client.prefetchInfiniteQuery(chatRoomsOptions(login, tab)),
    client.prefetchQuery(unreadSummaryOptions(login)),
  ]);
  return (
    <PageFrame title="채팅">
      <HydrationBoundary state={dehydrate(client)}>
        <ChatList />
      </HydrationBoundary>
    </PageFrame>
  );
}
