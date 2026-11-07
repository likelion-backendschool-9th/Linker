import { apiFetch } from '@/lib/api/api-fetch';

import type {
  OfferCounts,
  OfferFilter,
  OfferFirstMessage,
  OffersResponse,
} from '../../_lib/offer-types';

export function fetchOffers(filter: OfferFilter) {
  if (filter === 'ALL') return apiFetch<OffersResponse>('/api/v1/recruiter/offers');
  return apiFetch<OffersResponse>(
    `/api/v1/recruiter/offers?${new URLSearchParams({ status: filter })}`,
  );
}

export function fetchOfferCounts() {
  return apiFetch<OfferCounts>('/api/v1/recruiter/offers/counts');
}

export function fetchOfferFirstMessage(roomId: string) {
  return apiFetch<OfferFirstMessage>(
    `/api/v1/recruiter/offers/${encodeURIComponent(roomId)}/first-message`,
  );
}
