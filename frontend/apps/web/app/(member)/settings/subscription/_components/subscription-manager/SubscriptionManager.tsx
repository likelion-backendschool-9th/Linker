'use client';

import { AltArrowRightLinearIcon } from '@solar-icons/static/linear/alt-arrow-right';
import type { Route } from 'next';
import Link from 'next/link';

import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Icon } from '@/components/ui/icon/Icon';
import { formatFullDate } from '@/lib/format/time';

import { ManageConfirmDialog } from '../manage-confirm-dialog';
import styles from './SubscriptionManager.module.css';
import { planLabel, type Payment, type Subscription } from './api';
import { PAYMENT_PREVIEW, useSubscriptionManager } from './hook';

/** Figma copy under the plan name (the same line on the Pro and Flex frames) */
const PLAN_DESCRIPTION = '더 많은 기회와 팀 매칭을 위한 전문가 요금제 입니다';

const PAYMENT_RESULT: Record<string, string> = {
  DONE: '결제',
  CANCELED: '환불',
  PARTIAL_CANCELED: '부분 환불',
};

const won = (value: number) => value.toLocaleString('ko-KR');
const cycle = (billing: string) => (billing === 'YEARLY' ? '연간' : '월간');

function Chevron() {
  return (
    <span className={styles.chevron} aria-hidden>
      <Icon svg={AltArrowRightLinearIcon} />
    </span>
  );
}

/** Figma 294:306 (Pro) / 295:459 (Flex): current plan card, info box, payment history; one card per subscription. */
export function SubscriptionManager() {
  const {
    subs,
    payments,
    cancel,
    refund,
    action,
    selectedSub,
    selectedPayment,
    showAll,
    onShowAll,
    onNotImplemented,
    submit,
    open,
  } = useSubscriptionManager();

  return (
    <div className={styles.page}>
      {subs.isPending ? (
        <p role="status" className={styles.status}>
          구독을 불러오고 있어요.
        </p>
      ) : subs.isError ? (
        <ErrorState description={subs.error.message} onRetry={() => void subs.refetch()} />
      ) : !subs.data.items.length ? (
        <PlanCard name="무료" href="/subscribe" />
      ) : (
        subs.data.items.map((sub) => (
          <section
            key={sub.subscriptionId}
            className={styles.subscription}
            aria-label={`${planLabel(sub.planKey)} 요금제${sub.teamName ? ` · ${sub.teamName}` : ''}`}
          >
            <PlanCard
              name={planLabel(sub.planKey)}
              teamName={sub.teamName}
              description={PLAN_DESCRIPTION}
              href={(sub.teamId ? `/subscribe?teamId=${sub.teamId}` : '/subscribe') as Route}
            />
            <SubscriptionInfo
              sub={sub}
              disabled={action.isPending}
              onCancel={() => open('cancel', sub.subscriptionId)}
              onChangePayer={onNotImplemented}
            />
          </section>
        ))
      )}
      <section className={styles.history} aria-labelledby="payments-title">
        <div className={styles.historyHeader}>
          <h2 id="payments-title" className={styles.historyTitle}>
            결제 내역
          </h2>
          {!showAll && (payments.data?.items.length ?? 0) > PAYMENT_PREVIEW && (
            <button type="button" className={styles.showAll} onClick={onShowAll}>
              전체 보기
              <Chevron />
            </button>
          )}
        </div>
        {payments.isPending ? (
          <p role="status" className={styles.status}>
            결제 내역을 불러오고 있어요.
          </p>
        ) : payments.isError ? (
          <ErrorState
            description={payments.error.message}
            onRetry={() => void payments.refetch()}
          />
        ) : !payments.data.items.length ? (
          <p className={styles.status}>결제 내역이 없어요.</p>
        ) : (
          <ul className={styles.payments}>
            {(showAll ? payments.data.items : payments.data.items.slice(0, PAYMENT_PREVIEW)).map(
              (payment) => (
                <PaymentRow
                  key={payment.paymentId}
                  payment={payment}
                  disabled={action.isPending}
                  onRefund={() => open('refund', payment.paymentId)}
                />
              ),
            )}
          </ul>
        )}
      </section>
      <ManageConfirmDialog
        overlay={cancel}
        title="요금제 해지"
        description={
          selectedSub && (
            <>
              <p>
                요금제를 해지하면 {formatFullDate(selectedSub.expiresOn)}까지만 혜택을 받을 수
                있어요. 해지 하시겠습니까?
              </p>
              {selectedSub.planKey === 'FLEX' && (
                <p>
                  Flex 종료 후 30일 동안 전체 대화와 이미지 원본을 유지해요. 이후 오래된 대화는
                  숨겨지고, 보관 기간이 지난 이미지 원본은 삭제돼요.
                </p>
              )}
              {selectedSub.planKey === 'SCOUT' && (
                <p>혜택이 끝나면 채용 광고 노출이 종료되고, 채용 제안은 하루 10건으로 돌아가요.</p>
              )}
            </>
          )
        }
        unavailable={
          selectedSub && !selectedSub.cancelAtPeriodEnd
            ? null
            : '해지할 수 있는 구독을 다시 선택해 주세요.'
        }
        confirmLabel="해지 하기"
        pending={action.isPending}
        error={action.isError ? action.error.message : null}
        onConfirm={() => selectedSub && submit('cancel', selectedSub.subscriptionId)}
      />
      <ManageConfirmDialog
        overlay={refund}
        title="전액 환불"
        description={
          selectedPayment && (
            <p>
              {selectedPayment.orderName} {won(selectedPayment.amount)}원을 전액 환불할까요? 이
              결제의 이용 기간이 취소되고, 앞서 결제한 기간은 그대로 이용할 수 있어요.
            </p>
          )
        }
        unavailable={
          selectedPayment?.refundable ? null : '환불할 수 있는 결제를 다시 선택해 주세요.'
        }
        confirmLabel="환불 하기"
        pending={action.isPending}
        error={action.isError ? action.error.message : null}
        onConfirm={() => selectedPayment && submit('refund', selectedPayment.paymentId)}
      />
    </div>
  );
}

function PlanCard({
  name,
  teamName,
  description,
  href,
}: {
  name: string;
  teamName?: string | null;
  description?: string;
  href: Route;
}) {
  return (
    <article className={styles.card}>
      <p className={styles.cardLabel}>현재 사용 중인 요금제</p>
      <div className={styles.cardText}>
        <h2 className={styles.planName}>
          {name} 요금제{teamName && <span className={styles.teamName}> · {teamName}</span>}
        </h2>
        {description && <p className={styles.planDescription}>{description}</p>}
      </div>
      <Link href={href} className={styles.change}>
        요금제 변경하기
      </Link>
    </article>
  );
}

function SubscriptionInfo({
  sub,
  disabled,
  onCancel,
  onChangePayer,
}: {
  sub: Subscription;
  disabled: boolean;
  onCancel: () => void;
  onChangePayer: () => void;
}) {
  const name = planLabel(sub.planKey);
  const flex = sub.planKey === 'FLEX';
  const headcount = sub.nextSeats ?? sub.seats;
  // Auto-renewal is [Included]: until a billing key exists there is no next payment, only the end date.
  const dateLabel = sub.nextBillingOn
    ? '다음 결제일'
    : sub.cancelAtPeriodEnd
      ? '혜택 종료일'
      : '이용 만료일';
  return (
    <div className={styles.info}>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{dateLabel}</dt>
          <dd>
            <time dateTime={sub.nextBillingOn ?? sub.expiresOn}>
              {formatFullDate(sub.nextBillingOn ?? sub.expiresOn)}
            </time>
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>현재 결제 주기</dt>
          <dd>{cycle(sub.billing)} 결제</dd>
        </div>
        <div className={styles.fact}>
          <dt>{sub.billing === 'YEARLY' ? '연' : '월'} 결제 금액</dt>
          <dd>
            {won(sub.amount)}({name})
          </dd>
        </div>
        {flex && headcount !== null && (
          <div className={styles.fact}>
            <dt>팀 인원</dt>
            <dd>{headcount}명</dd>
          </div>
        )}
        {flex && (
          <div className={styles.fact}>
            <dt>결제 담당자</dt>
            <dd>{sub.payerName ?? '알 수 없음'}</dd>
          </div>
        )}
      </dl>
      {flex && (
        <button type="button" className={styles.action} onClick={onChangePayer}>
          결제 담당자 변경
        </button>
      )}
      {sub.cancelAtPeriodEnd ? (
        <p className={styles.action}>해지 예약됨 · 만료일까지 혜택이 유지돼요</p>
      ) : (
        <button type="button" className={styles.action} disabled={disabled} onClick={onCancel}>
          요금제 해지
          <span className="sr-only"> · {sub.teamName ?? name}</span>
          <Chevron />
        </button>
      )}
    </div>
  );
}

function PaymentRow({
  payment,
  disabled,
  onRefund,
}: {
  payment: Payment;
  disabled: boolean;
  onRefund: () => void;
}) {
  return (
    <li className={styles.payment}>
      <div className={styles.paymentText}>
        <time className={styles.paymentDate} dateTime={payment.approvedAt}>
          {formatFullDate(payment.approvedAt)}
        </time>
        <span className={styles.paymentName}>
          {planLabel(payment.planKey)} {cycle(payment.billing)} 결제
        </span>
      </div>
      <div className={styles.paymentSide}>
        <span className={styles.paymentAmount}>
          {won(payment.amount)} 원 {PAYMENT_RESULT[payment.status] ?? payment.status}
        </span>
        {payment.refundable && (
          <button type="button" className={styles.refund} disabled={disabled} onClick={onRefund}>
            환불
            <span className="sr-only"> · {payment.orderName}</span>
          </button>
        )}
      </div>
    </li>
  );
}
