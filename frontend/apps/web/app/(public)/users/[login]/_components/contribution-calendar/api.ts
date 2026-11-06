import { apiFetch } from '@/lib/api/api-fetch';

export type ContributionResponse = {
  month: string;
  days: { date: string; count: number }[];
  asOf: string;
};

export function fetchContributions(login: string, month: string) {
  return apiFetch<ContributionResponse>(
    `/api/v1/public/users/${encodeURIComponent(login)}/contributions?month=${month}`,
  );
}
