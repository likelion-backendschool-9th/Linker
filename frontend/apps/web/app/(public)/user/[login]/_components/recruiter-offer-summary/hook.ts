'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchOfferSummary } from './api';

export function useRecruiterOfferSummary() {
  const summary = useQuery({
    queryKey: ['recruiter-offer-summary'],
    queryFn: fetchOfferSummary,
  });

  const limit = summary.data
    ? summary.data.scoutSubscribed
      ? summary.data.scoutTodayLimit
      : summary.data.todayLimit
    : 0;
  const remaining = summary.data ? Math.max(0, limit - summary.data.todayUsed) : 0;

  return { summary, limit, remaining };
}
