import { CHAT } from '@/lib/policy';

import { MessageOutbox, type PendingMessage } from './message-outbox';

const message = {
  clientMessageId: 'dedupe-1',
  text: '안녕하세요',
  createdAt: '2026-11-01T00:00:00Z',
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('waits for ACK, retries with the same ID, and stops after three retries', () => {
  const send = vi.fn<(item: PendingMessage) => boolean>(() => true);
  const outbox = new MessageOutbox(send, { ackTimeoutMs: 20, retryDelayMs: 5 });
  outbox.enqueue(message);
  vi.runAllTimers();
  expect(send).toHaveBeenCalledTimes(CHAT.autoRetries + 1);
  expect(send.mock.calls.every(([item]) => item.clientMessageId === message.clientMessageId)).toBe(
    true,
  );
  expect(outbox.getSnapshot()[0]?.status).toBe('failed');
  outbox.dispose();
});

it('ACK removes the pending bubble and cancels retries, including synchronous delivery', () => {
  const send = vi.fn((item: PendingMessage): boolean => {
    outbox.acknowledge(item.clientMessageId);
    return true;
  });
  const outbox: MessageOutbox = new MessageOutbox(send, { ackTimeoutMs: 10 });
  outbox.enqueue(message);
  vi.runAllTimers();
  expect(send).toHaveBeenCalledTimes(1);
  expect(outbox.getSnapshot()).toEqual([]);
});

it('paces sends at the policy limit and cleans up timers on unmount', () => {
  const send = vi.fn<(item: PendingMessage) => boolean>(() => true);
  const outbox = new MessageOutbox(send);
  for (let i = 0; i < CHAT.sendsPerSecond + 1; i++)
    outbox.enqueue({ ...message, clientMessageId: `id-${i}` });
  vi.advanceTimersByTime(999);
  expect(send).toHaveBeenCalledTimes(CHAT.sendsPerSecond);
  outbox.dispose();
  vi.advanceTimersByTime(60_000);
  expect(send).toHaveBeenCalledTimes(CHAT.sendsPerSecond);
});

it('manual retry reuses the ID and restored pending messages require user action', () => {
  const send = vi.fn(() => false);
  const outbox = new MessageOutbox(send);
  outbox.restore([{ ...message, status: 'sending' }]);
  expect(outbox.getSnapshot()[0]?.status).toBe('failed');
  expect(send).not.toHaveBeenCalled();
  outbox.retry(message.clientMessageId);
  vi.advanceTimersByTime(0);
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({ clientMessageId: message.clientMessageId }),
  );
  outbox.discard(message.clientMessageId);
  vi.runAllTimers();
  expect(outbox.getSnapshot()).toEqual([]);
});

it('preserves uploaded images through automatic retry, restore and manual retry', () => {
  const send = vi.fn<(item: PendingMessage) => boolean>(() => false);
  const outbox = new MessageOutbox(send, { ackTimeoutMs: 10, retryDelayMs: 5 });
  const image = { fileId: 'uploaded-1', url: '/mock/cover-1.svg' };
  outbox.enqueue({ ...message, text: '', images: [image] });
  vi.runAllTimers();
  expect(send).toHaveBeenCalledTimes(CHAT.autoRetries + 1);
  expect(send.mock.calls.every(([item]) => item.clientMessageId === message.clientMessageId && item.images?.[0]?.fileId === image.fileId)).toBe(true);
  const saved = JSON.parse(JSON.stringify(outbox.getSnapshot())) as PendingMessage[];
  outbox.dispose();
  const restoredSend = vi.fn(() => true);
  const restored = new MessageOutbox(restoredSend);
  restored.restore(saved);
  restored.retry(message.clientMessageId);
  vi.advanceTimersByTime(0);
  expect(restoredSend).toHaveBeenCalledWith(expect.objectContaining({ text: '', images: [image], clientMessageId: message.clientMessageId }));
  restored.dispose();
});

it('retains mentions and repository-qualified issue references through retries', () => {
  const send = vi.fn<(item: PendingMessage) => boolean>(() => false);
  const outbox = new MessageOutbox(send, { ackTimeoutMs: 10, retryDelayMs: 5 });
  const references = { mentionedUserIds: [2], mentionAll: true, issueRefs: [{ number: 15, repoId: 11 }] };
  outbox.enqueue({ ...message, text: '@doyun @전체 #15', references });
  vi.runAllTimers();
  expect(send).toHaveBeenCalledTimes(CHAT.autoRetries + 1);
  expect(send.mock.calls.every(([item]) => item.clientMessageId === message.clientMessageId && JSON.stringify(item.references) === JSON.stringify(references))).toBe(true);
  outbox.dispose();
});
