import { MOCK_ROLE_COOKIE } from '@/lib/auth/mock-viewer';
import { CHAT } from '@/lib/policy';

import { MESSAGES, type MockMessage } from './fixtures/chat';
import { brief, ME } from './fixtures/users';
import { mockFetch } from './mock-fetch';

const length = MESSAGES.length;
let message: MockMessage;
beforeEach(() => {
  document.cookie = `${MOCK_ROLE_COOKIE}=developer; path=/`;
  message = { id: 90001, roomId: 10, sender: brief(ME), type: 'TEXT', text: '원문', imageUrls: [], payload: null, createdAt: new Date(Date.now() - 1000).toISOString(), editedAt: null, deletedAt: null };
  MESSAGES.push(message);
});
afterEach(() => {
  MESSAGES.splice(length);
  document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
});
function edit(text: string, roomId = 10) {
  return mockFetch(`/api/v1/user/chat-rooms/${roomId}/messages/90001`, { method: 'PATCH', body: JSON.stringify({ text }) });
}
it('edits own text and keeps a tombstone after deleting', async () => {
  await edit(' 수정 ');
  expect(message.text).toBe('수정');
  expect(message.editedAt).not.toBeNull();
  await mockFetch('/api/v1/user/chat-rooms/10/messages/90001', { method: 'DELETE' });
  expect(message.text).toBeNull();
  expect(message.deletedAt).not.toBeNull();
});
it('rejects expired edits, empty text and a mismatched room', async () => {
  await expect(edit('')).rejects.toMatchObject({ status: 400 });
  await expect(edit('변경', 11)).rejects.toMatchObject({ status: 404 });
  message.createdAt = new Date(Date.now() - CHAT.editWithinHours * 60 * 60 * 1000).toISOString();
  await expect(edit('변경')).rejects.toMatchObject({ status: 403 });
  expect(message.text).toBe('원문');
});
it('does not allow deleting another author in a direct chat or system messages', async () => {
  message.sender = null;
  await expect(mockFetch('/api/v1/user/chat-rooms/10/messages/90001', { method: 'DELETE' })).rejects.toMatchObject({ status: 403 });
  message.sender = brief(ME);
  message.type = 'PR_EVENT';
  await expect(mockFetch('/api/v1/user/chat-rooms/10/messages/90001', { method: 'DELETE' })).rejects.toMatchObject({ status: 403 });
});
