import type { Metadata } from 'next';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { ApiError } from '@/lib/api/api-error';
import { getSession } from '@/lib/auth/session';
import { profileHref } from '@/lib/navigation/collaboration-links';
import { buildMetadata } from '@/lib/seo/metadata';

import { fetchOfferCounts, fetchOffers } from './_components/recruiter-offers-view/api';
import { RecruiterOffersView } from './_components/recruiter-offers-view/RecruiterOffersView';
import type { OfferCounts, OffersResponse } from './_lib/offer-types';
import { isOfferFilter } from './_lib/offer-types';

export const metadata: Metadata = buildMetadata({ title: '보낸 제안', path: '/recruiter/offers' });

export default async function RecruiterOffersPage({ searchParams }: PageProps<'/recruiter/offers'>) {
  const query = await searchParams;
  const rawStatus = Array.isArray(query.status) ? query.status[0] : query.status;
  const initialStatus = isOfferFilter(rawStatus) ? rawStatus : 'ALL';
  const session = await getSession();
  let initialOffers: OffersResponse | null = null;
  let initialCounts: OfferCounts | null = null;
  let initialError: string | null = null;

  try {
    [initialOffers, initialCounts] = await Promise.all([
      fetchOffers(initialStatus),
      fetchOfferCounts(),
    ]);
  } catch (error) {
    initialError = error instanceof ApiError ? error.message : '채용 제안 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
  }

  return (
    <PageFrame
      title="보낸 제안"
      variant="stack"
      backHref={session?.login ? profileHref(session.login) : '/feed'}
      bottomTabs={false}
    >
      <RecruiterOffersView
        initialStatus={initialStatus}
        initialOffers={initialOffers}
        initialCounts={initialCounts}
        initialError={initialError}
      />
    </PageFrame>
  );
}
