import { apiFetch } from '@/lib/api/api-fetch';

import type {
  OfferCounts,
  OfferFirstMessage,
  OfferStatus,
  OffersResponse,
} from '../../_lib/offer-types';

export function fetchOffers(status: OfferStatus) {
  return apiFetch<OffersResponse>(
    `/api/v1/recruiter/offers?${new URLSearchParams({ status })}`,
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
