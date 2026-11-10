import type { ChatMessageResponse } from '@linker/api/openAPIDefinition.schemas';

import { apiFetch } from '@/lib/api/api-fetch';

/** One minutes line. `messageId` is the source message (null when the model gave none). */
export type AiSummaryItem = { text: string; messageId: number | null };

/** Hand-written until the client is regenerated (blueprint §2-1); matches `AiChatSummaryResponse`. */
export type AiChatSummary = {
  summaryId: number;
  status: 'PENDING' | 'DONE' | 'FAILED';
  phase: 'QUEUED' | 'READING' | 'WRITING' | 'DONE' | 'FAILED';
  /** 0–100; an estimate while READING, never 100 before DONE */
  progress: number;
  queueAhead: number;
  remainingSeconds: number | null;
  oneLine: string | null;
  decisions: AiSummaryItem[];
  actionItems: AiSummaryItem[];
  openQuestions: AiSummaryItem[];
  messageCount: number;
  sharedMessageId: number | null;
  usedToday: number;
  limit: number;
  disclaimer: string;
};

/** Minutes copied into an `AI_SUMMARY` chat card's payload when shared. */
export type SharedAiSummary = Pick<
  AiChatSummary,
  'oneLine' | 'decisions' | 'actionItems' | 'openQuestions' | 'messageCount' | 'disclaimer'
>;

export const aiSummaryKey = (roomId: number, summaryId: number) =>
  ['chat', 'ai-summary', roomId, summaryId] as const;

/** Always answers 202 with a PENDING summary; a second tap returns the one already running. */
export function createAiSummary(roomId: number) {
  return apiFetch<AiChatSummary>(`/api/v1/user/chat-rooms/${roomId}/ai-summaries`, {
    method: 'POST',
  });
}

export function getAiSummary(roomId: number, summaryId: number) {
  return apiFetch<AiChatSummary>(`/api/v1/user/chat-rooms/${roomId}/ai-summaries/${summaryId}`);
}

/** Posts the minutes as an `AI_SUMMARY` card; sharing again returns the same card. */
export function shareAiSummary(roomId: number, summaryId: number) {
  return apiFetch<ChatMessageResponse>(
    `/api/v1/user/chat-rooms/${roomId}/ai-summaries/${summaryId}/share`,
    { method: 'POST' },
  );
}

function items(value: unknown): AiSummaryItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { text, messageId } = entry as Record<string, unknown>;
    if (typeof text !== 'string' || !text) return [];
    return [{ text, messageId: typeof messageId === 'number' ? messageId : null }];
  });
}

/** Reads a shared card's payload defensively: it is stored JSON, not a typed response. */
export function sharedSummary(payload: unknown): SharedAiSummary | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  if (typeof value.oneLine !== 'string' || !value.oneLine) return null;
  return {
    oneLine: value.oneLine,
    decisions: items(value.decisions),
    actionItems: items(value.actionItems),
    openQuestions: items(value.openQuestions),
    messageCount: typeof value.messageCount === 'number' ? value.messageCount : 0,
    disclaimer:
      typeof value.disclaimer === 'string' ? value.disclaimer : 'AI가 만든 요약이라 틀릴 수 있어요',
  };
}
