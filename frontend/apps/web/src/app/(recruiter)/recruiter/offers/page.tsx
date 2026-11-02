import type { Metadata } from 'next';

import { PageFrame } from '@/components/layout/page-frame';
import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { buildMetadata } from '@/lib/seo/metadata';

import { RecruiterOffersView } from './_components/recruiter-offers-view';
import type { OfferCounts, OffersResponse } from './_lib/offer-types';
import { isOfferStatus } from './_lib/offer-types';

export const metadata: Metadata = buildMetadata({ title: '보낸 채용 제안', path: '/recruiter/offers' });

export default async function RecruiterOffersPage({ searchParams }: PageProps<'/recruiter/offers'>) {
  const query = await searchParams;
  const rawStatus = Array.isArray(query.status) ? query.status[0] : query.status;
  const initialStatus = isOfferStatus(rawStatus) ? rawStatus : 'TALKING';
  let initialOffers: OffersResponse | null = null;
  let initialCounts: OfferCounts | null = null;
  let initialError: string | null = null;

  try {
    const search = new URLSearchParams({ status: initialStatus });
    [initialOffers, initialCounts] = await Promise.all([
      apiFetch<OffersResponse>(`/api/v1/recruiter/offers?${search}`),
      apiFetch<OfferCounts>('/api/v1/recruiter/offers/counts'),
    ]);
  } catch (error) {
    initialError = error instanceof ApiError ? error.message : '채용 제안 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
  }

  return (
    <PageFrame title="보낸 채용 제안" variant="tab">
      <RecruiterOffersView
        initialStatus={initialStatus}
        initialOffers={initialOffers}
        initialCounts={initialCounts}
        initialError={initialError}
      />
    </PageFrame>
  );
}
