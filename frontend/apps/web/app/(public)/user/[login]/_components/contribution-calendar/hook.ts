'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { parseAsString, useQueryState } from 'nuqs';

import { toKst } from '@/lib/format/time';

import { fetchContributions } from './api';

export const CONTRIBUTION_WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function shiftMonth(month: string, by: number) {
  const [year, value] = month.split('-').map(Number) as [number, number];
  const next = new Date(year, value - 1 + by, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

export function useContributionCalendar(login: string) {
  const currentMonth = format(toKst(new Date()), 'yyyy-MM');
  const [month, setMonth] = useQueryState(
    'contributionMonth',
    parseAsString.withDefault(currentMonth).withOptions({ shallow: true, history: 'replace' }),
  );
  const monthKey = /^\d{4}-\d{2}$/.test(month) ? month : currentMonth;
  const contributions = useQuery({
    queryKey: ['profile-contributions', login, monthKey],
    queryFn: () => fetchContributions(login, monthKey),
  });

  const data = contributions.data;
  const [year, monthNumber] = data
    ? (data.month.split('-').map(Number) as [number, number])
    : [0, 0];
  const firstOffset = data ? (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7 : 0;
  const totalDays = data ? new Date(year, monthNumber, 0).getDate() : 0;
  const dayCounts = new Map(data?.days.map((day) => [day.date, day.count]) ?? []);
  const total = data?.days.reduce((sum, day) => sum + day.count, 0) ?? 0;
  const minimumMonth = shiftMonth(currentMonth, -11);

  return {
    contributions,
    data,
    year,
    monthNumber,
    firstOffset,
    totalDays,
    dayCounts,
    total,
    monthKey,
    currentMonth,
    minimumMonth,
    prevMonth: () => void setMonth(shiftMonth(monthKey, -1)),
    nextMonth: () => void setMonth(shiftMonth(monthKey, 1)),
  };
}
