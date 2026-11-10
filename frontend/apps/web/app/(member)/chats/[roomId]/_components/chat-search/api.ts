import type {
  ChatMessageResponse,
  ChatHistoryLimitResponse,
} from '@linker/api/openAPIDefinition.schemas';

import { apiFetch } from '@/lib/api/api-fetch';

export type ChatSearchResponse = {
  items: ChatMessageResponse[];
  history: ChatHistoryLimitResponse | null;
};

export function searchChatMessages(roomId: number, query: string, signal?: AbortSignal) {
  return apiFetch<ChatSearchResponse>(
    `/api/v1/user/chat-rooms/${roomId}/search?q=${encodeURIComponent(query)}`,
    { signal },
  );
}
