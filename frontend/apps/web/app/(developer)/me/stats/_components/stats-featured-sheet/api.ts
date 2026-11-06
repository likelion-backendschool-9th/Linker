import { apiFetch } from '@/lib/api/api-fetch';

export function fetchPinnedPostIds(login: string, signal?: AbortSignal) {
  return apiFetch<{ pinnedPostIds: number[] }>(
    `/api/v1/public/user/${encodeURIComponent(login)}`,
    { signal },
  );
}
