import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/api-fetch';

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
};

/** WBS P17; server enforces room access and mutual follows for DIRECT rooms. */
export function linkPreviewOptions(login: string | null, roomId: number, url: string | null) {
  return queryOptions({
    queryKey: ['chat', login, 'room', roomId, 'link-preview', url],
    retry: false,
    queryFn: ({ signal }) =>
      apiFetch<LinkPreview | null>(
        `/api/v1/user/chat-rooms/${roomId}/link-preview?url=${encodeURIComponent(url!)}`,
        { signal },
      ),
  });
}
