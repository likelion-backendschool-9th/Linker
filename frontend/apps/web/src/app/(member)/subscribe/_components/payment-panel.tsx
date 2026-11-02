'use client';

import { useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import type { CheckoutOrder } from '@/features/subscription/subscription-api';
import { formatWon } from '@/lib/format/number';
import { mountPaymentWidget, type PaymentWidget } from '@/lib/payments/payment-widget';

import styles from './subscription.module.css';

export function PaymentPanel({ order, onBack }: { order: CheckoutOrder; onBack: () => void }) {
  const router = useRouter();
  const widget = useRef<PaymentWidget | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let mounted: PaymentWidget | null = null;
    void mountPaymentWidget(
      order,
      { methods: '#subscription-methods', agreement: '#subscription-agreement' },
      abort.signal,
    )
      .then(async (value) => {
        if (abort.signal.aborted) {
          await value.destroy();
          return;
        }
        mounted = value;
        widget.current = value;
        setReady(true);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => {
      abort.abort();
      widget.current = null;
      void mounted?.destroy();
    };
  }, [order, attempt]);
  async function pay() {
    if (!widget.current || pending) return;
    setPending(true);
    setError(false);
    try {
      const path = await widget.current.requestPayment();
      if (path) router.replace(path as Route);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className={styles.checkout} aria-label="결제 주문 확인">
      <h2 className={styles.heading}>{order.orderName}</h2>
      <p>이용 기간: {order.billing === 'YEARLY' ? '연간' : '월간'}</p>
      <p>
        결제 금액 <strong>{formatWon(order.amount)}</strong>
      </p>
      <p className={styles.notice}>테스트 결제라 실제로 돈이 나가지 않아요</p>
      <div id="subscription-methods" className={styles.widget} />
      <div id="subscription-agreement" className={styles.widget} />
      {!ready && !error && <p role="status">결제 화면을 준비하고 있어요.</p>}
      {error && (
        <ErrorState
          title="결제를 진행하지 못했어요"
          description="결제 동의를 확인한 뒤 다시 시도해 주세요."
          onRetry={
            !ready
              ? () => {
                  setReady(false);
                  setError(false);
                  setAttempt((value) => value + 1);
                }
              : undefined
          }
        />
      )}
      <div className={styles.actions}>
        <Button variant="outline" disabled={pending} onClick={onBack}>
          요금제 다시 선택
        </Button>
        <Button
          disabled={!ready || pending}
          onClick={() => {
            void pay();
          }}
        >
          {pending ? '결제 요청 중…' : '결제하기'}
        </Button>
      </div>
    </section>
  );
}
