import { apiFetch } from '@/lib/api/api-fetch';

export type AiChatSummary = {
  summaryId: number;
  status: 'PENDING' | 'DONE' | 'FAILED';
  summary: string | null;
  messageCount: number;
  usedToday: number;
  limit: number;
  disclaimer: string;
};

export function createAiSummary(roomId: number) {
  return apiFetch<AiChatSummary>(`/api/v1/user/chat-rooms/${roomId}/ai-summaries`, {
    method: 'POST',
  });
}

export function getAiSummary(roomId: number, summaryId: number) {
  return apiFetch<AiChatSummary>(
    `/api/v1/user/chat-rooms/${roomId}/ai-summaries/${summaryId}`,
  );
}

/** Poll until DONE/FAILED or attempts run out. */
export async function waitForAiSummary(
  roomId: number,
  summaryId: number,
  signal?: AbortSignal,
): Promise<AiChatSummary> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const row = await getAiSummary(roomId, summaryId);
    if (row.status !== 'PENDING') return row;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return getAiSummary(roomId, summaryId);
}
