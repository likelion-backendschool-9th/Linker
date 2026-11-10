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
  summary: null,
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

it('reads a shared card payload defensively, including cards shared as minutes', () => {
  expect(sharedSummary(null)).toBeNull();
  expect(sharedSummary({ summary: '' })).toBeNull();
  expect(sharedSummary({ summary: 5 })).toBeNull();
  expect(sharedSummary({ summary: '한 문단 요약' })).toEqual({ summary: '한 문단 요약' });
  expect(sharedSummary({ oneLine: '예전 요약', decisions: [] })).toEqual({ summary: '예전 요약' });
});
