'use client';

import { useMutation } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { withPaymentReturnTo } from '@/lib/payments/payment-return';

import { recordPaymentFailure } from './api';

export function usePaymentFailure({
  orderId,
  code,
  returnTo,
}: {
  orderId: string | null;
  code: string;
  returnTo?: string | null;
}) {
  const router = useRouter();
  const started = useRef(false);
  const failure = useMutation({ mutationFn: () => recordPaymentFailure(orderId!, code) });
  const { mutate } = failure;
  useEffect(() => {
    if (orderId && !started.current) {
      started.current = true;
      mutate();
    }
  }, [orderId, mutate]);

  return {
    failure,
    retry: () => failure.mutate(),
    goSubscribe: () => router.replace(withPaymentReturnTo('/subscribe', returnTo) as Route),
    goHome: () => router.replace('/feed'),
  };
}
