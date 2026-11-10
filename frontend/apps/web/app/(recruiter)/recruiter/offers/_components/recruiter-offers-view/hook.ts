'use client';

import { useQuery } from '@tanstack/react-query';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { useOverlay } from '@/lib/navigation/use-overlay';

import type { OfferCounts, OfferFilter, OfferStatus, OffersResponse } from '../../_lib/offer-types';
import { OFFER_FILTERS } from '../../_lib/offer-types';
import { fetchOfferCounts, fetchOfferFirstMessage, fetchOffers } from './api';

export const FILTER_LABELS: Record<OfferFilter, string> = {
  ALL: '전체',
  TALKING: '대화 진행',
  WAITING: '응답 대기',
  NO_RESPONSE: '응답 없음',
};

export const STATUS_PILL_LABELS: Record<OfferStatus, string> = {
  TALKING: '대화 진행 중',
  WAITING: '응답 대기 중',
  NO_RESPONSE: '응답 없음',
};

export function useRecruiterOffersView({
  initialStatus,
  initialOffers,
  initialCounts,
  initialError,
}: {
  initialStatus: OfferFilter;
  initialOffers: OffersResponse | null;
  initialCounts: OfferCounts | null;
  initialError: string | null;
}) {
  const [status, setStatus] = useQueryState(
    'status',
    parseAsStringLiteral(OFFER_FILTERS)
      .withDefault(initialStatus)
      .withOptions({ shallow: true, history: 'replace' }),
  );
  const messageSheet = useOverlay('recruiter-offer-message');
  const enabled = !initialError;

  const offers = useQuery({
    queryKey: ['recruiter-offers', status],
    queryFn: () => fetchOffers(status),
    initialData: status === initialStatus ? (initialOffers ?? undefined) : undefined,
    enabled,
  });
  const counts = useQuery({
    queryKey: ['recruiter-offer-counts'],
    queryFn: () => fetchOfferCounts(),
    initialData: initialCounts ?? undefined,
    enabled,
  });
  const firstMessage = useQuery({
    queryKey: ['recruiter-offer-first-message', messageSheet.id],
    queryFn: () => fetchOfferFirstMessage(messageSheet.id ?? ''),
    enabled: messageSheet.isOpen && Boolean(messageSheet.id),
    retry: false,
  });

  const sortedOffers = [...(offers.data?.items ?? [])].sort(
    (left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt),
  );
  const total = counts.data
    ? counts.data.TALKING + counts.data.WAITING + counts.data.NO_RESPONSE
    : 0;
  const listError = initialError ?? (offers.error instanceof Error ? offers.error.message : null);
  const countsError = counts.error instanceof Error ? counts.error.message : null;

  return {
    status,
    setStatus,
    messageSheet,
    offers,
    counts,
    firstMessage,
    sortedOffers,
    total,
    listError,
    countsError,
    initialError,
    handlers: {
      showMessage: (roomId: number) => messageSheet.open(String(roomId)),
      retryList: () => {
        void offers.refetch();
        void counts.refetch();
      },
      reloadPage: () => window.location.reload(),
    },
  };
}
