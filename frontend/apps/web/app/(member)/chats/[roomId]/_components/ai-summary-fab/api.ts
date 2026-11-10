import type { ChatMessageResponse } from '@linker/api/openAPIDefinition.schemas';

import { apiFetch } from '@/lib/api/api-fetch';

/** Hand-written until the client is regenerated (blueprint §2-1); matches `AiChatSummaryResponse`. */
export type AiChatSummary = {
  summaryId: number;
  status: 'PENDING' | 'DONE' | 'FAILED';
  phase: 'QUEUED' | 'READING' | 'WRITING' | 'DONE' | 'FAILED';
  /** 0–100; an estimate while READING, never 100 before DONE */
  progress: number;
  queueAhead: number;
  remainingSeconds: number | null;
  /** One paragraph (user decision 2026-11-11); null until DONE */
  summary: string | null;
  messageCount: number;
  sharedMessageId: number | null;
  usedToday: number;
  limit: number;
  disclaimer: string;
};

/** The paragraph copied into an `AI_SUMMARY` chat card's payload when shared. */
export type SharedAiSummary = { summary: string };

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

/**
 * Reads a shared card's payload defensively: it is stored JSON, not a typed response. Cards shared
 * before 2026-11-11 carry the old minutes' `oneLine`, which is shown as their paragraph.
 */
export function sharedSummary(payload: unknown): SharedAiSummary | null {
  if (!payload || typeof payload !== 'object') return null;
  const { summary, oneLine } = payload as Record<string, unknown>;
  const text = typeof summary === 'string' && summary ? summary : oneLine;
  return typeof text === 'string' && text ? { summary: text } : null;
}
