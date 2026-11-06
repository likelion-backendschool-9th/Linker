'use client';

import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import type { CheckoutOrder } from '@/features/subscription/subscription-api';
import { formatWon } from '@/lib/format/number';

import styles from '../subscription.module.css';
import { usePaymentPanel } from './hook';

export function PaymentPanel({
  order,
  onBack,
  returnTo,
}: {
  order: CheckoutOrder;
  onBack: () => void;
  returnTo?: string | null;
}) {
  const { ready, pending, error, pay, remount } = usePaymentPanel({ order, returnTo });

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
          onRetry={!ready ? remount : undefined}
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
