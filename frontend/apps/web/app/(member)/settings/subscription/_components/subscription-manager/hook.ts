'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  cancelSubscription,
  paymentsOptions,
  refundPayment,
  subscriptionKeys,
  subscriptionsOptions,
} from './api';

export function useSubscriptionManager() {
  const { login } = useViewer();
  const client = useQueryClient();
  const subs = useQuery(subscriptionsOptions(login));
  const payments = useQuery(paymentsOptions(login));
  const cancel = useOverlay('subscription-cancel');
  const refund = useOverlay('payment-refund');
  const action = useMutation({
    mutationFn: async (input: { kind: 'cancel' | 'refund'; id: string }) =>
      input.kind === 'cancel' ? cancelSubscription(input.id) : refundPayment(input.id),
    throwOnError: false,
    onSuccess: async (_, input) => {
      if (input.kind === 'cancel') cancel.close();
      else refund.close();
      toast(
        input.kind === 'cancel'
          ? '해지를 예약했어요. 만료일까지 혜택을 이용할 수 있어요.'
          : '전액 환불됐어요. 구독 혜택이 종료됐어요.',
      );
      await client.invalidateQueries({ queryKey: subscriptionKeys.account(login) });
    },
  });
  const selectedSub = subs.data?.items.find((item) => String(item.id) === cancel.id);
  const selectedPayment = payments.data?.items.find((item) => String(item.id) === refund.id);

  return {
    subs,
    payments,
    cancel,
    refund,
    action,
    selectedSub,
    selectedPayment,
    submit: (kind: 'cancel' | 'refund', id: string) => {
      if (!action.isPending) action.mutate({ kind, id });
    },
    open: (kind: 'cancel' | 'refund', id: string) => {
      if (action.isPending) return;
      action.reset();
      (kind === 'cancel' ? cancel : refund).open(String(id));
    },
  };
}
