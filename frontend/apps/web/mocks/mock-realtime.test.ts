import { CHAT } from '@/lib/policy';
import { UPLOADED_IMAGES } from './fixtures/uploads';
import { MOCK_ROLE_COOKIE } from '@/lib/auth/mock-viewer';

import { MESSAGES } from './fixtures/chat';
import { publish, subscribe } from './mock-realtime';

beforeEach(() => {
  vi.useFakeTimers();
  document.cookie = `${MOCK_ROLE_COOKIE}=developer; path=/`;
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
});

it('deduplicates retried client IDs and echoes an ACK without duplicating the teammate reply', () => {
  const listener = vi.fn();
  const unsubscribe = subscribe('/topic/chat-rooms/1', listener);
  const before = MESSAGES.length;
  const body = { clientMessageId: 'retry-unique', text: '중복 없이 보내요' };
  expect(publish('/app/chat-rooms/1/messages', body)).toBe(true);
  expect(publish('/app/chat-rooms/1/messages', body)).toBe(true);
  expect(MESSAGES.length).toBe(before + 1);
  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.objectContaining({ clientMessageId: body.clientMessageId }),
    }),
  );
  vi.runAllTimers();
  expect(MESSAGES.length).toBe(before + 2);
  unsubscribe();
});

it('does not send into a read-only room or a pending request', () => {
  const before = MESSAGES.length;
  expect(publish('/app/chat-rooms/3/messages', { text: '읽기 전용' })).toBe(false);
  expect(publish('/app/chat-rooms/20/messages', { text: '요청 중' })).toBe(false);
  expect(MESSAGES.length).toBe(before);
});

it('sends completed photo file IDs without text and deduplicates retries', () => {
  UPLOADED_IMAGES.set('photo-1', '/mock/cover-1.svg');
  const body = { clientMessageId: 'photo-dedupe', text: '', fileIds: ['photo-1'] };
  const before = MESSAGES.length;
  expect(publish('/app/chat-rooms/1/messages', body)).toBe(true);
  expect(publish('/app/chat-rooms/1/messages', body)).toBe(true);
  expect(MESSAGES.length).toBe(before + 1);
  expect(MESSAGES.at(-1)).toMatchObject({ type: 'IMAGE', text: '', imageUrls: ['/mock/cover-1.svg'] });
  UPLOADED_IMAGES.delete('photo-1');
});
it('rejects unknown file IDs, too many photos and an empty message', () => {
  UPLOADED_IMAGES.set('photo-limit', '/mock/cover-1.svg');
  const before = MESSAGES.length;
  expect(publish('/app/chat-rooms/1/messages', { fileIds: ['not-complete'] })).toBe(false);
  expect(publish('/app/chat-rooms/1/messages', { fileIds: Array(CHAT.imagesPerSend + 1).fill('photo-limit') })).toBe(false);
  expect(publish('/app/chat-rooms/1/messages', { text: '', fileIds: [] })).toBe(false);
  expect(MESSAGES.length).toBe(before);
  UPLOADED_IMAGES.delete('photo-limit');
});
