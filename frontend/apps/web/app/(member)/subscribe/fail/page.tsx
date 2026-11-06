import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { safeReturnTo } from '@/lib/auth/return-to';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { PaymentFailure } from '../_components/payment-failure/PaymentFailure';
export const metadata = buildMetadata({ title: '결제 실패', path: '/subscribe/fail' });
export default async function PaymentFailurePage({ searchParams }: PageProps<'/subscribe/fail'>) {
  const [params, session] = await Promise.all([searchParams, getSession()]);
  const orderId = typeof params.orderId === 'string' ? params.orderId : null;
  const code = typeof params.code === 'string' ? params.code : 'PAYMENT_FAILED';
  const message =
    typeof params.message === 'string'
      ? params.message
      : '결제 정보를 확인한 뒤 다시 시도해 주세요.';
  return (
    <PageFrame title="결제 실패" variant="stack">
      <PaymentFailure
        key={`${session?.login}:${orderId ?? 'missing'}`}
        orderId={orderId}
        code={code}
        message={message}
        returnTo={safeReturnTo(typeof params.returnTo === 'string' ? params.returnTo : null)}
      />
    </PageFrame>
  );
}
