import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

/** Provisional CatalogController contract; replace with Orval types when OpenAPI is available. */
export type TechTag = { id: number; name: string };

/** Fixed tag list (19 filter, 05 profile edit, 20/22 editors); public and rarely changes */
export function techTagsOptions() {
  return queryOptions({
    queryKey: ['tech-tags'] as const,
    queryFn: ({ signal }) => apiFetch<TechTag[]>('/api/v1/public/tech-tags', { signal }),
    staleTime: Infinity,
  });
}
