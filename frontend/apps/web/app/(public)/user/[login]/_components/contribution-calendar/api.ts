import { apiFetch } from '@/lib/api/api-fetch';

export type ContributionResponse = {
  month: string;
  days: { date: string; count: number }[];
  asOf: string;
};

export async function fetchContributions(login: string, month: string): Promise<ContributionResponse | null> {
  const data = await apiFetch<ContributionResponse>(
    `/api/v1/public/user/${encodeURIComponent(login)}/contributions?${new URLSearchParams({ month })}`,
  );
  if (!data.month || !data.asOf) return null;
  const days = (data.days ?? []).flatMap((day) =>
    day.date != null && day.count != null ? [{ date: day.date, count: day.count }] : [],
  );
  return { month: data.month, asOf: data.asOf, days };
}
