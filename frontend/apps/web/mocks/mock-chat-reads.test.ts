import { MOCK_ROLE_COOKIE } from '@/lib/auth/mock-viewer';

import { MESSAGES, type MockMessage } from './fixtures/chat';
import { READ_POSITIONS, recordRead, unreadMembers, withReadState } from './fixtures/chat-reads';
import { TEAM_MEMBERS } from './fixtures/teams';
import { brief, ME } from './fixtures/users';
import { mockFetch } from './mock-fetch';
import { subscribe } from './realtime-bus';

const length = MESSAGES.length;
let message: MockMessage;
beforeEach(() => {
  READ_POSITIONS.clear();
  document.cookie = `${MOCK_ROLE_COOKIE}=developer; path=/`;
  message = { id: 90005, roomId: 1, sender: TEAM_MEMBERS[1]![1]!.user, type: 'TEXT', text: '대화', imageUrls: [], payload: null, createdAt: new Date().toISOString(), editedAt: null, deletedAt: null };
  MESSAGES.push(message);
});
afterEach(() => {
  MESSAGES.splice(length);
  READ_POSITIONS.clear();
  document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
});
it('keeps the REST count and unread list consistent and broadcasts reads', async () => {
  const initial = withReadState(message).unreadCount;
  const listener = vi.fn();
  const unsubscribe = subscribe('/topic/chat-rooms/1', listener);
  try {
    await mockFetch('/api/v1/user/chat-rooms/1/read', { method: 'POST', body: JSON.stringify({ lastReadMessageId: message.id }) });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ event: 'READ', roomId: 1 }));
    const page = await mockFetch<{ items: { id: number; unreadCount: number }[] }>('/api/v1/user/chat-rooms/1/messages');
    expect(page.items.find((item) => item.id === message.id)?.unreadCount).toBe(initial - 1);
    const list = await mockFetch<{ items: { id: number }[] }>('/api/v1/user/chat-rooms/1/messages/90005/unread-members');
    expect(list.items).toHaveLength(initial - 1);
    expect(list.items.some((item) => item.id === ME.id || item.id === message.sender!.id)).toBe(false);
  } finally { unsubscribe(); }
});
it('keeps read positions monotonic and isolated by room', () => {
  recordRead(1, ME.id, message.id);
  recordRead(1, ME.id, 1);
  expect(unreadMembers(message).some((member) => member.id === ME.id)).toBe(false);
  expect(READ_POSITIONS.get(2)?.has(ME.id)).not.toBe(true);
});
it('rejects a message ID from another room and does not expose a direct unread-members list', async () => {
  await expect(mockFetch('/api/v1/user/chat-rooms/2/read', { method: 'POST', body: JSON.stringify({ lastReadMessageId: message.id }) })).rejects.toMatchObject({ status: 404 });
  await expect(mockFetch('/api/v1/user/chat-rooms/2/messages/90005/unread-members')).rejects.toMatchObject({ status: 404 });
});
it('models the counterpart reading an outgoing direct message', () => {
  const direct = { ...message, roomId: 10, sender: brief(ME) };
  const members = unreadMembers(direct);
  expect(members).toHaveLength(1);
  recordRead(10, members[0]!.id, direct.id);
  expect(withReadState(direct).unreadCount).toBe(0);
});
