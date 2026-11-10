'use client';

import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import type { PaymentReturn } from '@/features/subscription/subscription-api';
import { formatWon } from '@/lib/format/number';
import { formatDate } from '@/lib/format/time';

import styles from '../subscription.module.css';
import { BenefitList } from '../benefit-list';
import { planLabel } from './api';
import { usePaymentSuccess } from './hook';

export function PaymentSuccess({
  payment,
  returnTo,
}: {
  payment: PaymentReturn | null;
  returnTo?: string | null;
}) {
  const { approval, goService, goSubscribe, goManage, retry } = usePaymentSuccess({
    payment,
    returnTo,
  });

  if (!payment)
    return (
      <ErrorState
        title="결제 정보를 확인할 수 없어요"
        description="요금제 화면에서 다시 결제해 주세요."
        onRetry={goSubscribe}
      />
    );
  if (approval.isError)
    return (
      <ErrorState
        title="결제 승인을 확인하지 못했어요"
        description="결제 완료로 처리되지 않았어요. 다시 확인해 주세요."
        onRetry={retry}
      />
    );
  if (!approval.data) return <p role="status">서버에서 결제 승인을 확인하고 있어요.</p>;
  if (approval.data.status !== 'ACTIVE')
    return <ErrorState title="결제 승인이 완료되지 않았어요" onRetry={retry} />;
  const result = approval.data;
  return (
    <section className={styles.checkout} aria-label="결제 승인 결과">
      <h2 className={styles.heading}>결제를 완료했어요</h2>
      <p role="status">{planLabel(result.planKey)} 혜택이 적용됐어요.</p>
      <p>
        {formatWon(result.amount)} · 이용 기간 {formatDate(result.expiresOn)}까지
      </p>
      <BenefitList benefits={result.benefits} />
      <Button onClick={goService}>서비스 이용하기</Button>
      <Button variant="outline" onClick={goManage}>
        구독 관리
      </Button>
    </section>
  );
}
