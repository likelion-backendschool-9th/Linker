import { apiFetch } from '@/lib/api/api-fetch';

export type PullRequest = {
  number: number;
  title: string;
  state: 'open' | 'merged';
  author: string;
  url: string;
};

export function fetchPullRequests(
  roomId: number,
  state: 'open' | 'merged',
  signal?: AbortSignal,
) {
  return apiFetch<{ items: PullRequest[] }>(
    `/api/v1/user/chat-rooms/${roomId}/pull-requests?state=${state}`,
    { signal },
  );
}
