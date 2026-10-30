import 'server-only';

import { ApiError } from './api-error';

const API_BASE_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/**
 * Cookie-less GET into the Next fetch cache, for public data only (legal, tech tags, job categories,
 * plans, contribution graph; blueprint §9-1, §9-2). Never pass anything that depends on the viewer.
 * Invalidate with `revalidateTag(tag, 'max')`.
 */
export async function fetchPublicCached<T>(
  url: `/api/v1/public/${string}`,
  { revalidate = 86_400, tags }: { revalidate?: number; tags: string[] },
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    cache: 'force-cache',
    next: { revalidate, tags },
  });
  if (!res.ok) throw await ApiError.from(res);
  return res.json();
}
