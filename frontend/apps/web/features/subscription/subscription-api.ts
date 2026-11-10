import {
  confirmPayment as confirmPaymentApi,
  createCheckout as createCheckoutApi,
  getListFlexTeamCandidatesQueryOptions,
  getListPlansQueryOptions,
  recordPaymentFailure as recordPaymentFailureApi,
} from '@linker/api/p28-subscribe/p28-subscribe';
import type {
  CheckoutResponse,
  PaymentResultResponse,
  PlanResponse,
  PlansResponse,
  TeamCandidateResponse,
} from '@linker/api/openAPIDefinition.schemas';

export type PlanKey = 'FREE' | 'PRO' | 'FLEX' | 'SCOUT';
export type PaidPlanKey = Exclude<PlanKey, 'FREE'>;
export type Billing = 'MONTHLY' | 'YEARLY';
export const PLAN_LABELS = { FREE: '무료', PRO: 'Pro', FLEX: 'Flex', SCOUT: 'Scout' } as const;

/** Server plan keys are plain strings in OpenAPI; unknown keys show as sent. */
export function planLabel(key: string): string {
  return key in PLAN_LABELS ? PLAN_LABELS[key as PlanKey] : key;
}

export type Plan = PlanResponse;
export type Plans = PlansResponse;
export type TeamCandidate = TeamCandidateResponse;
export type CheckoutOrder = CheckoutResponse;
export type PaymentResult = PaymentResultResponse;
export type PaymentReturn = { orderId: string; amount: number; paymentKey: string };

export const subscriptionKeys = {
  account: (login: string | null) => ['subscription', login] as const,
};

/** Plans include the caller's own plan, so the server answers `private, no-store` (Page TODO 28). */
export function plansOptions(login: string | null, reason: string) {
  return getListPlansQueryOptions(reason ? { reason } : undefined, {
    query: {
      queryKey: [...subscriptionKeys.account(login), 'plans', reason],
      refetchOnMount: 'always',
    },
    request: { cache: 'no-store' },
  });
}

export function teamCandidatesOptions(login: string | null) {
  return getListFlexTeamCandidatesQueryOptions({
    query: {
      queryKey: [...subscriptionKeys.account(login), 'team-candidates'],
      refetchOnMount: 'always',
    },
    request: { cache: 'no-store' },
  });
}

export function createCheckout(input: { planKey: PaidPlanKey; billing: Billing; teamId?: number }) {
  return createCheckoutApi(input);
}

export function confirmPayment(input: PaymentReturn) {
  return confirmPaymentApi(input);
}

export function recordPaymentFailure(orderId: string, code: string) {
  return recordPaymentFailureApi(orderId, { code });
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
