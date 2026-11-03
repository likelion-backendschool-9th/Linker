import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

/** Provisional CatalogController job categories (ERD `JobCategory`); public and fixed */
export type JobCategory = { key: string; label: string };

export function jobCategoriesOptions() {
  return queryOptions({
    queryKey: ['job-categories'] as const,
    queryFn: ({ signal }) => apiFetch<JobCategory[]>('/api/v1/public/job-categories', { signal }),
    staleTime: Infinity,
  });
}
