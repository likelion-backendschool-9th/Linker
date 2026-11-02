'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { recordPaymentFailure } from '@/features/subscription/subscription-api';

import styles from './subscription.module.css';

export function PaymentFailure({
  orderId,
  code,
  message,
}: {
  orderId: string | null;
  code: string;
  message: string;
}) {
  const router = useRouter();
  const started = useRef(false);
  const failure = useMutation({ mutationFn: () => recordPaymentFailure(orderId!, code) });
  const { mutate } = failure;
  useEffect(() => {
    if (orderId && !started.current) {
      started.current = true;
      mutate();
    }
  }, [orderId, mutate]);
  return (
    <section className={styles.checkout}>
      <h2 className={styles.heading}>결제를 완료하지 못했어요</h2>
      <p>{message}</p>
      {failure.isPending && <p role="status">결제 상태를 확인하고 있어요.</p>}
      {failure.isError && (
        <ErrorState title="결제 상태를 기록하지 못했어요" onRetry={() => failure.mutate()} />
      )}
      <Button onClick={() => router.replace('/subscribe')}>요금제에서 다시 시도</Button>
      <Button variant="outline" onClick={() => router.replace('/feed')}>
        홈으로
      </Button>
    </section>
  );
}
