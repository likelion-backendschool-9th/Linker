import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { RoomInfo, RoomMessage } from '../_lib/room-api';
import { ChatRoom } from './chat-room';

const subscription = vi.hoisted(() => ({ handler: undefined as ((event: { event: string }) => void) | undefined }));
vi.mock('@/lib/realtime/use-stomp', () => ({
  useStompConnectionState: () => 'idle',
  useStompSubscription: (_destination: string, handler: (event: { event: string }) => void) => { subscription.handler = handler; },
}));
vi.mock('../_hooks/use-message-outbox', () => ({
  useMessageOutbox: () => ({ outbox: { acknowledge: vi.fn() }, pending: [] }),
}));
vi.mock('./message-timeline', () => ({
  MessageTimeline: ({ messages, onUnread }: { messages: RoomMessage[]; onUnread: (id: number) => void }) =>
    <button onClick={() => onUnread(messages[0]!.id)}>안 읽음 {messages[0]!.unreadCount}명</button>,
}));
vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const room: RoomInfo = { id: 1, kind: 'TEAM', title: '팀', requestDirection: null, muted: false, members: [], team: { id: 1, name: '팀', plan: 'FREE', myRole: 'MEMBER', status: 'ACTIVE' }, historyLimitDays: 60 };
const message: RoomMessage = { id: 10, roomId: 1, unreadCount: 2, sender: null, type: 'TEXT', text: '대화', imageUrls: [], payload: null, createdAt: '2026-11-03T00:00:00Z', editedAt: null, deletedAt: null };
it('refreshes both the message count and the open unread-members sheet on a READ event', async () => {
  let read = false;
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path === '/api/v1/user/chat-rooms/1') return room;
    if (path === '/api/v1/user/chat-rooms/1/messages') return { items: [{ ...message, unreadCount: read ? 1 : 2 }], hasMore: false };
    if (path === '/api/v1/user/chat-rooms/1/messages/10/unread-members') return { items: (read ? ['서연'] : ['도윤', '서연']).map((name, id) => ({ id, name, login: name, avatarUrl: '' })) };
    throw new Error(`unexpected API: ${path}`);
  });
  renderWithProviders(<ChatRoom roomId={1} />, { viewer: { login: 'me', role: 'developer' } });
  await userEvent.click(await screen.findByRole('button', { name: '안 읽음 2명' }));
  expect(await screen.findByText('도윤')).toBeVisible();
  read = true;
  act(() => subscription.handler!({ event: 'READ' }));
  await waitFor(() => expect(screen.getByText('안 읽음 1명')).toBeInTheDocument());
  await waitFor(() => expect(screen.queryByText('도윤')).not.toBeInTheDocument());
  expect(screen.getByText('서연')).toBeVisible();
});
