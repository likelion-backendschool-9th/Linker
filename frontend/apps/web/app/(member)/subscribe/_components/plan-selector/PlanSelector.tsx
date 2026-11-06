'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { ApiError } from '@/lib/api/api-error';
import { SUBSCRIPTION_PRICE } from '@/lib/policy';
import { formatWon } from '@/lib/format/number';

import { PaymentPanel } from '../payment-panel';
import styles from '../subscription.module.css';
import { PLAN_LABELS } from './api';
import { REASONS, usePlanSelector } from './hook';

export function PlanSelector({
  reason,
  returnTo,
}: {
  reason: string;
  returnTo?: string | null;
}) {
  const {
    status,
    recruiter,
    plans,
    teams,
    billing,
    setBilling,
    teamId,
    setTeamId,
    order,
    setOrder,
    checkout,
    selectedTeam,
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

  return (
    <>
      <p className={styles.description}>현재 요금제: {PLAN_LABELS[plans.data.currentPlan]}</p>
      <p className={styles.intro}>필요한 만큼, 나와 팀에 맞는 요금제를 선택해 보세요.</p>
      {reason && (
        <p className={styles.notice}>
          {REASONS[reason] ?? '사용하려는 기능에 맞는 요금제를 확인해 보세요.'}
        </p>
      )}
      <p className={styles.notice}>테스트 결제라 실제로 돈이 나가지 않아요</p>
      <p className={styles.description}>
        선택한 이용 기간을 한 번 결제해요. 무료 체험과 정기 결제는 추후 제공 예정이에요.
      </p>
      {!recruiter && (
        <div className={styles.tabs} role="group" aria-label="Pro 결제 기간">
          <button
            type="button"
            disabled={checkout.isPending}
            aria-pressed={billing === 'MONTHLY'}
            onClick={() => {
              void setBilling('MONTHLY');
            }}
          >
            월간
          </button>
          <button
            type="button"
            disabled={checkout.isPending}
            aria-pressed={billing === 'YEARLY'}
            onClick={() => {
              void setBilling('YEARLY');
            }}
          >
            연간
          </button>
        </div>
      )}
      {checkout.isError && (
        <ErrorState
          title="주문을 준비하지 못했어요"
          description={
            checkout.error instanceof ApiError
              ? checkout.error.message
              : '잠시 후 다시 시도해 주세요.'
          }
        />
      )}
      <ul className={styles.plans}>
        {plans.data.plans
          .filter((plan) => (recruiter ? plan.key === 'SCOUT' : plan.key !== 'SCOUT'))
          .map((plan) => {
            const yearly = plan.key === 'PRO' && billing === 'YEARLY';
            const amount =
              plan.key === 'FLEX' && selectedTeam
                ? selectedTeam.amount
                : yearly
                  ? plan.yearly
                  : plan.monthly;
            return (
              <li key={plan.key}>
                <article className={styles.plan}>
                  <div className={styles.actions}>
                    <h2 className={styles.heading}>{plan.name}</h2>
                    {plans.data.currentPlan === plan.key && (
                      <span className={styles.tag}>현재 개인 요금제</span>
                    )}
                  </div>
                  <p className={styles.price}>
                    {amount === null ? '결제 기간을 확인해 주세요' : formatWon(amount)}
                    <span className={styles.description}>
                      {' '}
                      / {yearly ? '년' : '월'}
                      {plan.key === 'FLEX' && !selectedTeam && '부터'}
                    </span>
                  </p>
                  {plan.key === 'FLEX' && (
                    <>
                      <p className={styles.description}>Flex는 월간 결제만 가능해요.</p>
                      {plan.perExtraMember !== undefined && (
                        <p className={styles.description}>
                          {SUBSCRIPTION_PRICE.flexIncludedSeats}명까지 기본 요금, 이후 1명당{' '}
                          {formatWon(plan.perExtraMember)} 추가
                        </p>
                      )}
                      {teams.isPending ? (
                        <p role="status">결제할 팀을 확인하고 있어요.</p>
                      ) : teams.isError ? (
                        <ErrorState
                          title="팀 목록을 불러오지 못했어요"
                          onRetry={() => {
                            void teams.refetch();
                          }}
                        />
                      ) : (
                        <>
                          <label htmlFor="flex-team">결제할 팀</label>
                          <select
                            id="flex-team"
                            value={teamId}
                            className={styles.input}
                            disabled={checkout.isPending}
                            onChange={(event) => void setTeamId(event.target.value)}
                          >
                            <option value="">팀을 선택해 주세요</option>
                            {teams.data?.items.map((team) => (
                              <option key={team.teamId} value={team.teamId}>
                                {team.name} · {team.memberCount}명
                              </option>
                            ))}
                          </select>
                          {teamId && !selectedTeam && (
                            <p className={styles.notice}>
                              이 팀을 선택할 수 없어요. 결제할 수 있는 팀 목록에서 다시 선택해
                              주세요.
                            </p>
                          )}
                          {teams.data?.items.length === 0 && (
                            <p className={styles.description}>결제할 수 있는 팀이 없어요.</p>
                          )}
                        </>
                      )}
                      {selectedTeam && (
                        <p className={styles.description}>
                          {selectedTeam.memberCount}명 · {formatWon(selectedTeam.amount)} / 월
                        </p>
                      )}
                      <p className={styles.description}>인원이 바뀌면 다음 결제일부터 반영돼요</p>
                    </>
                  )}
                  <ul className={styles.benefits}>
                    {plan.benefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                  {plan.key === 'FREE' ? (
                    <Button variant="outline" asChild block>
                      <Link href="/feed">무료로 이용하기</Link>
                    </Button>
                  ) : (
                    <Button
                      block
                      disabled={
                        status === 'SUSPENDED' ||
                        checkout.isPending ||
                        amount === null ||
                        (plan.key === 'FLEX' && !selectedTeam)
                      }
                      onClick={() =>
                        checkout.mutate({
                          planKey: plan.key as 'PRO' | 'FLEX' | 'SCOUT',
                          billing: yearly ? 'YEARLY' : 'MONTHLY',
                          ...(plan.key === 'FLEX' && selectedTeam
                            ? { teamId: selectedTeam.teamId }
                            : {}),
                        })
                      }
                    >
                      {checkout.isPending ? '주문 준비 중…' : `${plan.name} 결제 준비`}
                    </Button>
                  )}
                </article>
              </li>
            );
          })}
      </ul>
    </>
  );
}
