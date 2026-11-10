'use client';

import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';

import styles from '../subscription.module.css';
import { usePaymentFailure } from './hook';

export function PaymentFailure({
  orderId,
  code,
  message,
  returnTo,
}: {
  orderId: string | null;
  code: string;
  message: string;
  returnTo?: string | null;
}) {
  const { failure, retry, goSubscribe, goHome } = usePaymentFailure({
    orderId,
    code,
    returnTo,
  });

  return (
    <section className={styles.checkout}>
      <h2 className={styles.heading}>결제를 완료하지 못했어요</h2>
      <p>{message}</p>
      {failure.isPending && <p role="status">결제 상태를 확인하고 있어요.</p>}
      {failure.isError && <ErrorState title="결제 상태를 기록하지 못했어요" onRetry={retry} />}
      <Button onClick={goSubscribe}>요금제에서 다시 시도</Button>
      <Button variant="outline" onClick={goHome}>
        홈으로
      </Button>
    </section>
  );
}
