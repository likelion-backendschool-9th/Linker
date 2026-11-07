import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { CHAT_TABS, chatRoomsOptions, unreadSummaryOptions } from '@/features/chat/chat-queries';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { ChatList } from './_components/chat-list/ChatList';

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
  // Wrap the whole frame: the bottom-tab badge reads the same summary query. If it rendered first,
  // the boundary would hydrate that query only in an effect and the SSR HTML would miss the counts.
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <PageFrame title="채팅">
        <ChatList />
      </PageFrame>
    </HydrationBoundary>
  );
}
