'use client';

import Link from 'next/link';

import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { ApiError } from '@/lib/api/api-error';
import { formatWon } from '@/lib/format/number';
import { SUBSCRIPTION_PRICE } from '@/lib/policy';

import { BenefitList } from '../benefit-list';
import { FlexTeamSheet } from '../flex-team-sheet';
import { PaymentPanel } from '../payment-panel';
import type { PaidPlanKey, Plan } from './api';
import styles from './PlanSelector.module.css';
import { REASONS, usePlanSelector } from './hook';

/** Figma 28 one-line pitch under each plan name */
const TAGLINES: Record<string, string> = {
  PRO: '내 포트폴리오가 더 잘 보이도록',
  FLEX: '팀 작업이 막히지 않게',
  SCOUT: '관심 직군이 맞는 개발자들에게 더 많이 노출 돼요',
};

function billingLine(plan: Plan, yearly: boolean) {
  if (plan.key === 'FLEX' && plan.perExtraMember != null)
    return `월간 청구, ${SUBSCRIPTION_PRICE.flexIncludedSeats + 1}명 이상 인당 + ${formatWon(plan.perExtraMember)}`;
  return yearly ? '연간 청구' : '월간 청구';
}

/**
 * Figma 28 (288:471 developer, 293:218 recruiter): title, 월간/연간 toggle, plan cards with a
 * "구독하기" button and benefits, terms links. Flex picks its team in a sheet first.
 */
export function PlanSelector({ reason, returnTo }: { reason: string; returnTo?: string | null }) {
  const {
    status,
    recruiter,
    plans,
    teams,
    billing,
    setBilling,
    teamId,
    flexTeam,
    order,
    setOrder,
    checkout,
  } = usePlanSelector(reason);

  if (plans.isPending)
    return (
      <div aria-busy="true">
        <p role="status">요금제를 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    );
  if (plans.isError)
    return (
      <ErrorState
        onRetry={() => {
          void plans.refetch();
        }}
      />
    );
  if (order)
    return (
      <PaymentPanel
        key={order.orderId}
        order={order}
        returnTo={returnTo}
        onBack={() => {
          setOrder(null);
          checkout.reset();
        }}
      />
    );

  // Figma shows only the paid plans: Pro and Flex for developers, Scout for recruiters.
  const visiblePlans = plans.data.plans.filter((plan) =>
    recruiter ? plan.key === 'SCOUT' : plan.key === 'PRO' || plan.key === 'FLEX',
  );
  const checkoutError = checkout.isError
    ? checkout.error instanceof ApiError
      ? checkout.error.message
      : '잠시 후 다시 시도해 주세요.'
    : null;
  const flexError = checkout.variables?.planKey === 'FLEX';

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <p className={styles.headline}>
          Linker를 구독하고
          <br />더 좋은 서비스를 경험해 보세요
        </p>
        <p className={styles.subtitle}>
          {recruiter
            ? '원하시는 인재를 더 빠르게 채용해 보세요'
            : '개발자와 팀을 위한 요금제를 선택해 더욱 편하게 개발하세요'}
        </p>
        {reason && (
          <p className={styles.reason}>
            {REASONS[reason] ?? '사용하려는 기능에 맞는 요금제를 확인해 보세요.'}
          </p>
        )}
      </div>
      {!recruiter && (
        <div className={styles.toggle} role="group" aria-label="Pro 결제 기간">
          {(['MONTHLY', 'YEARLY'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={styles.toggleButton}
              disabled={checkout.isPending}
              aria-pressed={billing === value}
              onClick={() => {
                void setBilling(value);
              }}
            >
              {value === 'MONTHLY' ? '월간 결제' : '연간 결제'}
            </button>
          ))}
        </div>
      )}
      {checkoutError && !flexError && (
        <ErrorState title="주문을 준비하지 못했어요" description={checkoutError} />
      )}
      {visiblePlans.length ? (
        <ul className={styles.plans}>
          {visiblePlans.map((plan) => {
            const yearly = plan.key === 'PRO' && billing === 'YEARLY';
            const amount = yearly ? plan.yearly : plan.monthly;
            return (
              <li key={plan.key}>
                <article className={styles.card}>
                  <div className={styles.summary}>
                    <div className={styles.nameBlock}>
                      <div className={styles.nameRow}>
                        <h2 className={styles.name}>{plan.name}</h2>
                        {plans.data.currentPlan === plan.key && (
                          <span className={styles.current}>이용 중</span>
                        )}
                      </div>
                      {TAGLINES[plan.key] && <p className={styles.tagline}>{TAGLINES[plan.key]}</p>}
                    </div>
                    <p className={styles.priceBlock}>
                      <span className={styles.price}>
                        {amount == null ? '결제 기간을 확인해 주세요' : formatWon(amount)}
                      </span>
                      <span className={styles.billing}>{billingLine(plan, yearly)}</span>
                    </p>
                    <button
                      type="button"
                      className={styles.cta}
                      disabled={status === 'SUSPENDED' || checkout.isPending || amount == null}
                      onClick={() => {
                        if (plan.key === 'FLEX') flexTeam.open();
                        else
                          checkout.mutate({
                            planKey: plan.key as PaidPlanKey,
                            billing: yearly ? 'YEARLY' : 'MONTHLY',
                          });
                      }}
                    >
                      {checkout.isPending && checkout.variables?.planKey === plan.key
                        ? '주문 준비 중…'
                        : `${plan.name} 플랜 구독하기`}
                    </button>
                  </div>
                  <BenefitList className={styles.benefits} benefits={plan.benefits} />
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.empty}>지금 결제할 수 있는 요금제가 없어요.</p>
      )}
      <nav className={styles.legal} aria-label="약관">
        <Link href="/legal/terms">이용 약관</Link>
        <Link href="/legal/privacy">개인정보처리방침</Link>
      </nav>
      {/* Figma copy kept by the user's decision; the free trial itself is [Included] and not built yet */}
      {!recruiter && (
        <p className={styles.trial}>계정 당 Pro, Flex의 무료 체험은 1회만 제공 됩니다</p>
      )}
      {!recruiter && (
        <FlexTeamSheet
          overlay={flexTeam}
          teams={teams}
          initialTeamId={teamId}
          pending={checkout.isPending}
          error={flexError ? checkoutError : null}
          disabled={status === 'SUSPENDED'}
          onSubmit={(id) => checkout.mutate({ planKey: 'FLEX', billing: 'MONTHLY', teamId: id })}
        />
      )}
    </div>
  );
}
