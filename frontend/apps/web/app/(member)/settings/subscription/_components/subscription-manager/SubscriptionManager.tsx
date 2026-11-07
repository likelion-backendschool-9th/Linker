'use client';

import Link from 'next/link';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { formatWon } from '@/lib/format/number';
import { formatDate } from '@/lib/format/time';

import styles from './SubscriptionManager.module.css';
import { planLabel } from './api';
import { useSubscriptionManager } from './hook';

const PAYMENT_STATUS: Record<string, string> = {
  DONE: '결제 완료',
  CANCELED: '환불 완료',
  PARTIAL_CANCELED: '부분 환불',
};

export function SubscriptionManager() {
  const { subs, payments, cancel, refund, action, selectedSub, selectedPayment, submit, open } =
    useSubscriptionManager();

  return (
    <div className={styles.content}>
      <p className={styles.notice}>
        테스트 결제라 실제로 돈이 나가지 않아요. 정기 결제 자동 갱신은 준비 중이에요.
      </p>
      <section aria-labelledby="subscriptions-title">
        <h2 id="subscriptions-title">현재 구독</h2>
        {subs.isPending ? (
          <p role="status">구독을 불러오고 있어요.</p>
        ) : subs.isError ? (
          <ErrorState description={subs.error.message} onRetry={() => void subs.refetch()} />
        ) : !subs.data.items.length ? (
          <p>이용 중인 유료 구독이 없어요. 무료 기능은 계속 사용할 수 있어요.</p>
        ) : (
          <ul className={styles.list}>
            {subs.data.items.map((sub) => {
              const name = planLabel(sub.planKey);
              const canceled = sub.cancelAtPeriodEnd;
              return (
                <li key={sub.subscriptionId}>
                  <article className={styles.card}>
                    <div className={styles.row}>
                      <h3>
                        {sub.teamName ? `${sub.teamName} · ` : ''}
                        {name}
                      </h3>
                      <span>{canceled ? '해지 예약' : '이용 중'}</span>
                    </div>
                    <p>
                      {sub.billing === 'YEARLY' ? '연간' : '월간'} 결제
                      {sub.seats !== null && ` · 결제 인원 ${sub.seats}명`}
                    </p>
                    <p>
                      {canceled ? '혜택 종료일' : '이용 기간 만료일'}{' '}
                      <time dateTime={sub.expiresOn}>{formatDate(sub.expiresOn)}</time>
                    </p>
                    {sub.nextBillingOn && !canceled && (
                      <p>
                        다음 결제일{' '}
                        <time dateTime={sub.nextBillingOn}>{formatDate(sub.nextBillingOn)}</time>
                      </p>
                    )}
                    {sub.nextSeats !== null && sub.nextAmount !== null && !canceled && (
                      <p>
                        다음 결제 예상: {sub.nextSeats}명 · {formatWon(sub.nextAmount)}
                        <br />
                        결제일의 팀원 수에 따라 금액이 달라질 수 있어요.
                      </p>
                    )}
                    {canceled && <p>만료일까지 혜택을 유지해요. 남은 기간의 일할 환불은 없어요.</p>}
                    {sub.planKey === 'FLEX' && canceled && (
                      <p>
                        Flex 종료 후 30일 동안 전체 대화와 이미지 원본을 유지해요. 이후 오래된
                        대화는 숨겨지고, 보관 기간이 지난 이미지 원본은 삭제돼요.
                      </p>
                    )}
                    {sub.planKey === 'SCOUT' && canceled && (
                      <p>
                        혜택이 끝나면 채용 광고 노출이 종료되고, 채용 제안은 하루 10건으로 돌아가요.
                      </p>
                    )}
                    {!canceled && (
                      <Button
                        variant="outline"
                        disabled={action.isPending}
                        onClick={() => open('cancel', sub.subscriptionId)}
                      >
                        해지하기<span className="sr-only"> · {sub.teamName ?? name}</span>
                      </Button>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/subscribe">요금제 보러 가기</Link>
      </section>
      <section aria-labelledby="payments-title">
        <h2 id="payments-title">결제 내역</h2>
        <p>결제 후 7일 이내이고 이용 기간이 아직 시작되지 않은 결제는 전액 환불할 수 있어요.</p>
        {payments.isPending ? (
          <p role="status">결제 내역을 불러오고 있어요.</p>
        ) : payments.isError ? (
          <ErrorState
            description={payments.error.message}
            onRetry={() => void payments.refetch()}
          />
        ) : !payments.data.items.length ? (
          <p>결제 내역이 없어요.</p>
        ) : (
          <ul className={styles.list}>
            {payments.data.items.map((payment) => (
              <li key={payment.paymentId}>
                <article className={styles.card}>
                  <h3>{payment.orderName}</h3>
                  <p>
                    <time dateTime={payment.approvedAt}>{formatDate(payment.approvedAt)}</time> ·{' '}
                    {formatWon(payment.amount)} · {PAYMENT_STATUS[payment.status] ?? payment.status}
                  </p>
                  {payment.refundable ? (
                    <Button
                      variant="outline"
                      disabled={action.isPending}
                      onClick={() => open('refund', payment.paymentId)}
                    >
                      환불하기<span className="sr-only"> · {payment.orderName}</span>
                    </Button>
                  ) : (
                    payment.refundReason && <p>{payment.refundReason}</p>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
      <OverlaySheet
        overlay={cancel}
        title="구독을 해지할까요?"
        description="혜택은 결제한 기간이 끝날 때까지 유지돼요. 남은 기간은 일할 환불되지 않아요."
      >
        {selectedSub && !selectedSub.cancelAtPeriodEnd ? (
          <>
            <p>{selectedSub.teamName ?? planLabel(selectedSub.planKey)}</p>
            {action.isError && <p role="alert">{action.error.message}</p>}
            <Button
              disabled={action.isPending}
              onClick={() => submit('cancel', selectedSub.subscriptionId)}
            >
              {action.isPending ? '처리 중이에요' : '해지 예약하기'}
            </Button>
          </>
        ) : (
          <p>해지할 수 있는 구독을 다시 선택해 주세요.</p>
        )}
      </OverlaySheet>
      <OverlaySheet
        overlay={refund}
        title="전액 환불할까요?"
        description="서버에서 환불 조건을 다시 확인해요. 환불하면 이 결제의 이용 기간이 취소되고, 앞서 결제한 기간은 그대로 이용할 수 있어요."
      >
        {selectedPayment?.refundable ? (
          <>
            <p>
              {selectedPayment.orderName} · {formatWon(selectedPayment.amount)}
            </p>
            {action.isError && <p role="alert">{action.error.message}</p>}
            <Button
              disabled={action.isPending}
              onClick={() => submit('refund', selectedPayment.paymentId)}
            >
              {action.isPending ? '처리 중이에요' : '전액 환불하기'}
            </Button>
          </>
        ) : (
          <p>환불할 수 있는 결제를 다시 선택해 주세요.</p>
        )}
      </OverlaySheet>
    </div>
  );
}
