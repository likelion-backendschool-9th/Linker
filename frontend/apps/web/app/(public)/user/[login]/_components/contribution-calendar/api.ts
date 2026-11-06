import { listPublicContributions } from '@linker/api/p04-profile/p04-profile';

export type ContributionResponse = {
  month: string;
  days: { date: string; count: number }[];
  asOf: string;
};

export async function fetchContributions(login: string, month: string): Promise<ContributionResponse | null> {
  const data = await listPublicContributions(login, { month });
  if (!data.month || !data.asOf) return null;
  const days = (data.days ?? []).flatMap((day) =>
    day.date != null && day.count != null ? [{ date: day.date, count: day.count }] : [],
  );
  return { month: data.month, asOf: data.asOf, days };
}
