import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import { PageFrame } from '@/components/layout/page-frame';
import { ApiError } from '@/lib/api/api-error';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { ChatRoom } from './_components/chat-room';
import { messagesOptions, roomInfoOptions } from './_lib/room-api';

// A private room's name and messages never enter metadata or social previews.
export async function generateMetadata({ params }: PageProps<'/chats/[roomId]'>) {
  const { roomId } = await params;
  return buildMetadata({ title: '채팅방', path: `/chats/${encodeURIComponent(roomId)}` });
}

export default async function ChatRoomPage({ params }: PageProps<'/chats/[roomId]'>) {
  const { roomId: value } = await params;
  if (!/^\d+$/.test(value)) notFound();
  const roomId = Number(value);
  if (!Number.isSafeInteger(roomId) || roomId <= 0) notFound();
  const session = await getSession();
  const client = getQueryClient();
  let room;
  try {
    room = await client.fetchQuery(roomInfoOptions(session?.login ?? null, roomId));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
  await client.prefetchInfiniteQuery(messagesOptions(session?.login ?? null, roomId));
  return (
    <PageFrame title={room.title} variant="stack" backHref="/chats">
      <HydrationBoundary state={dehydrate(client)}>
        <ChatRoom key={roomId} roomId={roomId} />
      </HydrationBoundary>
    </PageFrame>
  );
}
