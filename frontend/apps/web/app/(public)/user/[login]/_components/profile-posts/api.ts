import type { FeedPost } from '@/app/(public)/feed/_lib/feed-queries';
import { apiFetch } from '@/lib/api/api-fetch';

export function fetchProfilePosts(login: string) {
  return apiFetch<{ items: FeedPost[] }>(
    `/api/v1/public/user/${encodeURIComponent(login)}/posts`,
  );
}
