import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/api-fetch';
import { subscriptionKeys, type Billing } from './subscription-api';

/** WBS 29 provisional DTOs; replace with generated types once OpenAPI is available. */
export type Subscription = {
  id: string;
  kind: 'PRO' | 'FLEX' | 'SCOUT';
  name: string;
  teamName: string | null;
  status: 'ACTIVE' | 'CANCELING' | 'ENDED';
  billing: Billing;
  nextBillingDate: string | null;
  endsOn: string | null;
  amount: number;
  nextMemberCount: number | null;
  billingOwner: boolean;
};
export type Payment = {
  id: string;
  subscriptionId: string;
  amount: number;
  status: 'PAID' | 'REFUNDED';
  paidAt: string;
  description: string;
  refundable: boolean;
  refundReason: string | null;
};
export function subscriptionsOptions(login: string | null) {
  return queryOptions({
    queryKey: [...subscriptionKeys.account(login), 'management'],
    refetchOnMount: 'always',
    queryFn: ({ signal }) =>
      apiFetch<{ items: Subscription[] }>('/api/v1/user/me/subscriptions', {
        signal,
        cache: 'no-store',
      }),
  });
}
export function paymentsOptions(login: string | null) {
  return queryOptions({
    queryKey: [...subscriptionKeys.account(login), 'payments'],
    refetchOnMount: 'always',
    queryFn: ({ signal }) =>
      apiFetch<{ items: Payment[] }>('/api/v1/user/me/payments', { signal, cache: 'no-store' }),
  });
}
export function cancelSubscription(id: string) {
  return apiFetch<Subscription>(`/api/v1/user/me/subscriptions/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
}
export function refundPayment(id: string) {
  return apiFetch<Payment>(`/api/v1/user/me/payments/${encodeURIComponent(id)}/refund`, {
    method: 'POST',
  });
}
