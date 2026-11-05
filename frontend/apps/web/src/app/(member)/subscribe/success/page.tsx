import { PageFrame } from '@/components/layout/page-frame';
import { parsePaymentReturn } from '@/features/subscription/subscription-api';
import { safeReturnTo } from '@/lib/auth/return-to';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { PaymentSuccess } from '../_components/payment-success';
export const metadata = buildMetadata({ title: '결제 확인', path: '/subscribe/success' });
export default async function PaymentSuccessPage({
  searchParams,
}: PageProps<'/subscribe/success'>) {
  const [params, session] = await Promise.all([searchParams, getSession()]);
  const payment = parsePaymentReturn({
    orderId: typeof params.orderId === 'string' ? params.orderId : undefined,
    paymentKey: typeof params.paymentKey === 'string' ? params.paymentKey : undefined,
    amount: typeof params.amount === 'string' ? params.amount : undefined,
  });
  return (
    <PageFrame title="결제 확인" variant="stack">
      <PaymentSuccess
        key={`${session?.login}:${payment?.orderId ?? 'invalid'}`}
        payment={payment}
        returnTo={safeReturnTo(typeof params.returnTo === 'string' ? params.returnTo : null)}
      />
    </PageFrame>
  );
}
