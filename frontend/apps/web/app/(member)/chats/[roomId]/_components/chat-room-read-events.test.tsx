import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { RoomInfo, RoomMessage } from '../_lib/room-api';
import { ChatRoom } from './chat-room/ChatRoom';

const subscription = vi.hoisted(() => ({
  handlers: new Map<string, (event: { event?: string; type?: string; roomId?: number; clientMessageId?: string; retryable?: boolean; message?: object }) => void>(),
  acknowledge: vi.fn(),
  reject: vi.fn(),
}));
vi.mock('@/lib/realtime/use-stomp', () => ({
  useStompConnectionState: () => 'idle',
  useStompSubscription: (destination: string, handler: (event: never) => void) => {
    subscription.handlers.set(destination, handler as (event: {
      event?: string;
      type?: string;
      roomId?: number;
      clientMessageId?: string;
      retryable?: boolean;
      message?: object;
    }) => void);
  },
}));
vi.mock('../_hooks/use-message-outbox', () => ({
  useMessageOutbox: () => ({
    outbox: { acknowledge: subscription.acknowledge, reject: subscription.reject },
    pending: [],
  }),
}));
vi.mock('./message-timeline', () => ({
  MessageTimeline: ({ messages, onUnread }: { messages: RoomMessage[]; onUnread: (id: number) => void }) => (
    <>
      <div>{messages.map((item) => <span key={item.id}>{item.text}</span>)}</div>
      <button onClick={() => onUnread(messages[0]!.id)}>안 읽음 {messages[0]!.unreadCount}명</button>
    </>
  ),
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
  act(() => subscription.handlers.get('/topic/chat-rooms/1')!({ event: 'READ' }));
  await waitFor(() => expect(screen.getByText('안 읽음 1명')).toBeInTheDocument());
  await waitFor(() => expect(screen.queryByText('도윤')).not.toBeInTheDocument());
  expect(screen.getByText('서연')).toBeVisible();
});

it('acknowledges a stored send from the existing user queue', async () => {
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path === '/api/v1/user/chat-rooms/1') return room;
    if (path === '/api/v1/user/chat-rooms/1/messages') return { items: [message], hasMore: false };
    throw new Error(`unexpected API: ${path}`);
  });
  subscription.acknowledge.mockClear();
  renderWithProviders(<ChatRoom roomId={1} />, { viewer: { login: 'me', role: 'developer' } });
  await screen.findByRole('button', { name: '안 읽음 2명' });
  act(() => subscription.handlers.get('/user/queue/chat-rooms')?.({
    type: 'CHAT_SEND_ACCEPTED',
    roomId: 1,
    clientMessageId: 'saved-1',
  }));
  expect(subscription.acknowledge).toHaveBeenCalledWith('saved-1');
});

it('fails a rejected send without acknowledging it', async () => {
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path === '/api/v1/user/chat-rooms/1') return room;
    if (path === '/api/v1/user/chat-rooms/1/messages') return { items: [message], hasMore: false };
    throw new Error(`unexpected API: ${path}`);
  });
  subscription.acknowledge.mockClear();
  subscription.reject.mockClear();
  renderWithProviders(<ChatRoom roomId={1} />, { viewer: { login: 'me', role: 'developer' } });
  await screen.findByRole('button', { name: '안 읽음 2명' });
  act(() => subscription.handlers.get('/user/queue/chat-rooms')?.({
    type: 'CHAT_SEND_REJECTED',
    roomId: 1,
    clientMessageId: 'saved-1',
    retryable: false,
  }));
  expect(subscription.acknowledge).not.toHaveBeenCalled();
  expect(subscription.reject).toHaveBeenCalledWith('saved-1', false);
});

it('merges an EDIT into the cached message without refetching history', async () => {
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path === '/api/v1/user/chat-rooms/1') return room;
    if (path === '/api/v1/user/chat-rooms/1/messages') return { items: [message], hasMore: false };
    throw new Error(`unexpected API: ${path}`);
  });
  renderWithProviders(<ChatRoom roomId={1} />, { viewer: { login: 'me', role: 'developer' } });
  expect(await screen.findByText('대화')).toBeVisible();
  const handler = subscription.handlers.get('/topic/chat-rooms/1');
  const calls = vi.mocked(apiFetch).mock.calls.length;
  act(() => handler!({
    event: 'EDIT',
    message: { ...message, text: '고친 대화', editedAt: '2026-11-05T01:00:00Z' },
  }));
  await waitFor(() => expect(screen.getByText('고친 대화')).toBeVisible());
  expect(screen.queryByText('대화')).not.toBeInTheDocument();
  expect(vi.mocked(apiFetch).mock.calls.length).toBe(calls);
  act(() => handler!({
    event: 'DELETE',
    message: { ...message, text: '삭제된 메시지입니다', deletedAt: '2026-11-05T02:00:00Z' },
  }));
  await waitFor(() => expect(screen.getByText('삭제된 메시지입니다')).toBeVisible());
  act(() => handler!({
    event: 'EDIT',
    message: { ...message, text: '지연된 원문', editedAt: '2026-11-05T00:30:00Z', deletedAt: null },
  }));
  expect(screen.getByText('삭제된 메시지입니다')).toBeVisible();
  expect(screen.queryByText('지연된 원문')).not.toBeInTheDocument();
});
