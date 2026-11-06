'use client';

import Link from 'next/link';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { formatWon } from '@/lib/format/number';
import { formatDate } from '@/lib/format/time';

import styles from './SubscriptionManager.module.css';
import { useSubscriptionManager } from './hook';

export function SubscriptionManager() {
  const {
    subs,
    payments,
    cancel,
    refund,
    action,
    selectedSub,
    selectedPayment,
    submit,
    open,
  } = useSubscriptionManager();

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
            {subs.data.items.map((sub) => (
              <li key={sub.id}>
                <article className={styles.card}>
                  <div className={styles.row}>
                    <h3>
                      {sub.teamName ? `${sub.teamName} · ` : ''}
                      {sub.name}
                    </h3>
                    <span>
                      {sub.status === 'ACTIVE'
                        ? '이용 중'
                        : sub.status === 'CANCELING'
                          ? '해지 예약'
                          : '종료'}
                    </span>
                  </div>
                  <p>
                    {formatWon(sub.amount)} / {sub.billing === 'YEARLY' ? '년' : '월'}
                  </p>
                  {sub.nextBillingDate && (
                    <p>
                      이용 기간 만료일{' '}
                      <time dateTime={sub.nextBillingDate}>{formatDate(sub.nextBillingDate)}</time>
                    </p>
                  )}
                  {sub.endsOn && (
                    <p>
                      혜택 종료일 <time dateTime={sub.endsOn}>{formatDate(sub.endsOn)}</time>
                    </p>
                  )}
                  {sub.nextMemberCount !== null && sub.status === 'ACTIVE' && (
                    <p>
                      다음 결제 예상: {sub.nextMemberCount}명 · {formatWon(sub.amount)}
                      <br />
                      결제일의 팀원 수에 따라 금액이 달라질 수 있어요.
                    </p>
                  )}
                  {sub.status === 'CANCELING' && (
                    <p>만료일까지 혜택을 유지해요. 남은 기간의 일할 환불은 없어요.</p>
                  )}
                  {sub.kind === 'FLEX' && sub.status !== 'ACTIVE' && (
                    <p>
                      Flex 종료 후 30일 동안 전체 대화와 이미지 원본을 유지해요. 이후 오래된 대화는
                      숨겨지고, 보관 기간이 지난 이미지 원본은 삭제돼요.
                    </p>
                  )}
                  {sub.kind === 'SCOUT' && sub.status !== 'ACTIVE' && (
                    <p>
                      혜택이 끝나면 채용 광고 노출이 종료되고, 채용 제안은 하루 10건으로 돌아가요.
                    </p>
                  )}
                  {sub.status === 'ACTIVE' && sub.billingOwner && (
                    <Button
                      variant="outline"
                      disabled={action.isPending}
                      onClick={() => open('cancel', sub.id)}
                    >
                      해지하기<span className="sr-only"> · {sub.teamName ?? sub.name}</span>
                    </Button>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
        <Link href="/subscribe">요금제 보러 가기</Link>
      </section>
      <section aria-labelledby="payments-title">
        <h2 id="payments-title">결제 내역</h2>
        <p>결제 후 7일 이내이고 혜택을 사용하지 않았다면 전액 환불할 수 있어요.</p>
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
              <li key={payment.id}>
                <article className={styles.card}>
                  <h3>{payment.description}</h3>
                  <p>
                    <time dateTime={payment.paidAt}>{formatDate(payment.paidAt)}</time> ·{' '}
                    {formatWon(payment.amount)} ·{' '}
                    {payment.status === 'REFUNDED' ? '환불 완료' : '결제 완료'}
                  </p>
                  {payment.refundable ? (
                    <Button
                      variant="outline"
                      disabled={action.isPending}
                      onClick={() => open('refund', payment.id)}
                    >
                      환불하기<span className="sr-only"> · {payment.description}</span>
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
        {selectedSub?.status === 'ACTIVE' && selectedSub.billingOwner ? (
          <>
            <p>{selectedSub.teamName ?? selectedSub.name}</p>
            {action.isError && <p role="alert">{action.error.message}</p>}
            <Button disabled={action.isPending} onClick={() => submit('cancel', selectedSub.id)}>
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
        description="서버에서 환불 조건을 다시 확인해요. 환불이 완료되면 구독 혜택이 즉시 종료돼요."
      >
        {selectedPayment?.refundable ? (
          <>
            <p>
              {selectedPayment.description} · {formatWon(selectedPayment.amount)}
            </p>
            {action.isError && <p role="alert">{action.error.message}</p>}
            <Button
              disabled={action.isPending}
              onClick={() => submit('refund', selectedPayment.id)}
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
