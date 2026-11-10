'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  cancelSubscription,
  NOT_IMPLEMENTED,
  paymentsOptions,
  refundPayment,
  subscriptionKeys,
  subscriptionsOptions,
} from './api';

/** Figma 29 lists the three newest payments; "전체 보기" shows the rest of the first page. */
export const PAYMENT_PREVIEW = 3;

export function useSubscriptionManager() {
  const { login } = useViewer();
  const client = useQueryClient();
  const subs = useQuery(subscriptionsOptions(login));
  const payments = useQuery(paymentsOptions(login));
  const cancel = useOverlay('subscription-cancel');
  const refund = useOverlay('payment-refund');
  const [showAll, setShowAll] = useState(false);
  const action = useMutation({
    mutationFn: async (input: { kind: 'cancel' | 'refund'; id: number }) =>
      input.kind === 'cancel' ? cancelSubscription(input.id) : refundPayment(input.id),
    throwOnError: false,
    onSuccess: async (_, input) => {
      if (input.kind === 'cancel') cancel.close();
      else refund.close();
      toast(
        input.kind === 'cancel'
          ? '해지를 예약했어요. 만료일까지 혜택을 이용할 수 있어요.'
          : '전액 환불됐어요. 이 결제의 이용 기간이 취소됐어요.',
      );
      await client.invalidateQueries({ queryKey: subscriptionKeys.account(login) });
    },
  });
  const selectedSub = subs.data?.items.find((item) => String(item.subscriptionId) === cancel.id);
  const selectedPayment = payments.data?.items.find((item) => String(item.paymentId) === refund.id);

  return {
    subs,
    payments,
    cancel,
    refund,
    action,
    selectedSub,
    selectedPayment,
    showAll,
    onShowAll: () => setShowAll(true),
    onNotImplemented: () => toast(NOT_IMPLEMENTED, { tone: 'info' }),
    submit: (kind: 'cancel' | 'refund', id: number) => {
      if (!action.isPending) action.mutate({ kind, id });
    },
    open: (kind: 'cancel' | 'refund', id: number) => {
      if (action.isPending) return;
      action.reset();
      (kind === 'cancel' ? cancel : refund).open(String(id));
    },
  };
}
