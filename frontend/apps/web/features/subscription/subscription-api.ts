import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

export type PlanKey = 'FREE' | 'PRO' | 'FLEX' | 'SCOUT';
export type Billing = 'MONTHLY' | 'YEARLY';
export const PLAN_LABELS = { FREE: '무료', PRO: 'Pro', FLEX: 'Flex', SCOUT: 'Scout' } as const;
/** WBS 28 provisional DTOs, to be replaced by Orval after OpenAPI is available. */
export type Plan = {
  key: PlanKey;
  name: string;
  monthly: number;
  yearly: number | null;
  benefits: string[];
  trialAvailable: boolean;
  perExtraMember?: number;
};
export type Plans = { reason: string | null; plans: Plan[]; currentPlan: PlanKey };
export type TeamCandidate = {
  teamId: number;
  name: string;
  memberCount: number;
  amount: number;
  currentPlan: string;
};
export type CheckoutOrder = {
  orderId: string;
  amount: number;
  orderName: string;
  customerKey: string;
  planKey: Exclude<PlanKey, 'FREE'>;
  billing: Billing;
  teamId: number | null;
};
export type PaymentResult = {
  planKey: Exclude<PlanKey, 'FREE'>;
  status: 'ACTIVE';
  expiresOn: string;
  amount: number;
  benefits: string[];
};
export type PaymentReturn = { orderId: string; amount: number; paymentKey: string };
export const subscriptionKeys = {
  account: (login: string | null) => ['subscription', login] as const,
};
export function plansOptions(login: string | null, reason: string) {
  return queryOptions({
    queryKey: [...subscriptionKeys.account(login), 'plans', reason],
    refetchOnMount: 'always',
    queryFn: ({ signal }) =>
      apiFetch<Plans>(
        `/api/v1/user/plans${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`,
        { signal, cache: 'no-store' },
      ),
  });
}
export function teamCandidatesOptions(login: string | null) {
  return queryOptions({
    queryKey: [...subscriptionKeys.account(login), 'team-candidates'],
    refetchOnMount: 'always',
    queryFn: ({ signal }) =>
      apiFetch<{ items: TeamCandidate[] }>('/api/v1/user/plans/team-candidates', {
        signal,
        cache: 'no-store',
      }),
  });
}
export function createCheckout(input: {
  planKey: Exclude<PlanKey, 'FREE'>;
  billing: Billing;
  teamId?: number;
}) {
  return apiFetch<CheckoutOrder>('/api/v1/user/payments/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
export function confirmPayment(input: PaymentReturn) {
  return apiFetch<PaymentResult>('/api/v1/user/payments/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
export function recordPaymentFailure(orderId: string, code: string) {
  return apiFetch<void>(`/api/v1/user/payments/${encodeURIComponent(orderId)}/fail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}
export function parsePaymentReturn(params: {
  orderId?: string;
  amount?: string;
  paymentKey?: string;
}): PaymentReturn | null {
  if (!params.orderId || !params.paymentKey || !params.amount || !/^\d+$/.test(params.amount))
    return null;
  const amount = Number(params.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  return { orderId: params.orderId, paymentKey: params.paymentKey, amount };
}
