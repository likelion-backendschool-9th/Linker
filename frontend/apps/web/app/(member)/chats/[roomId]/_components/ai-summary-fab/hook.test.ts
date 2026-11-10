import type { AiChatSummary } from './api';
import { sharedSummary } from './api';
import { ringOf } from './hook';

const BASE: AiChatSummary = {
  summaryId: 1,
  status: 'PENDING',
  phase: 'QUEUED',
  progress: 0,
  queueAhead: 2,
  remainingSeconds: null,
  oneLine: null,
  decisions: [],
  actionItems: [],
  openQuestions: [],
  messageCount: 70,
  sharedMessageId: null,
  usedToday: 1,
  limit: 10,
  disclaimer: 'AI가 만든 요약이라 틀릴 수 있어요',
};

it('maps a summary to the button ring (POL-C-5)', () => {
  expect(ringOf(undefined)).toEqual({ state: 'idle' });
  expect(ringOf(BASE)).toEqual({ state: 'queued', queueAhead: 2 });
  expect(ringOf({ ...BASE, phase: 'READING', progress: 30, remainingSeconds: 80 })).toEqual({
    state: 'running',
    phase: 'READING',
    progress: 30,
    remainingSeconds: 80,
  });
  expect(ringOf({ ...BASE, status: 'DONE', phase: 'DONE', progress: 100 })).toEqual({
    state: 'done',
  });
  expect(ringOf({ ...BASE, status: 'FAILED', phase: 'FAILED' })).toEqual({ state: 'failed' });
  // Sharing clears the ring
  expect(ringOf({ ...BASE, status: 'DONE', phase: 'DONE', sharedMessageId: 9 })).toEqual({
    state: 'idle',
  });
});

it('reads a shared card payload defensively', () => {
  expect(sharedSummary(null)).toBeNull();
  expect(sharedSummary({ oneLine: '' })).toBeNull();
  expect(
    sharedSummary({
      oneLine: '요약',
      decisions: [{ text: '결정', messageId: 3 }, { text: 5 }, null],
      actionItems: 'nope',
    }),
  ).toEqual({
    oneLine: '요약',
    decisions: [{ text: '결정', messageId: 3 }],
    actionItems: [],
    openQuestions: [],
    messageCount: 0,
    disclaimer: 'AI가 만든 요약이라 틀릴 수 있어요',
  });
});
