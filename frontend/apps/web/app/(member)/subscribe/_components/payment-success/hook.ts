'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { safeReturnTo } from '@/lib/auth/return-to';

import { confirmPayment, type PaymentReturn } from './api';

export function usePaymentSuccess({
  payment,
  returnTo,
}: {
  payment: PaymentReturn | null;
  returnTo?: string | null;
}) {
  const started = useRef(false);
  const client = useQueryClient();
  const router = useRouter();
  const approval = useMutation({
    mutationFn: confirmPayment,
    throwOnError: false,
    onSuccess: async () => {
      await client.invalidateQueries();
    },
  });
  const { mutate } = approval;
  useEffect(() => {
    if (payment && !started.current) {
      started.current = true;
      mutate(payment);
    }
  }, [payment, mutate]);

  return {
    approval,
    goService: () => router.replace(safeReturnTo(returnTo) as Route),
    goSubscribe: () => router.replace('/subscribe'),
    goManage: () => router.replace('/settings/subscription'),
    retry: () => {
      if (payment) approval.mutate(payment);
    },
  };
}
