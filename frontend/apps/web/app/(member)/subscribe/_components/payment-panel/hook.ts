'use client';

import { useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import type { CheckoutOrder } from '@/features/subscription/subscription-api';
import { mountPaymentWidget, type PaymentWidget } from '@/lib/payments/payment-widget';

export function usePaymentPanel({
  order,
  returnTo,
}: {
  order: CheckoutOrder;
  returnTo?: string | null;
}) {
  const router = useRouter();
  const widget = useRef<PaymentWidget | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    let mounted: PaymentWidget | null = null;
    void mountPaymentWidget(
      order,
      { methods: '#subscription-methods', agreement: '#subscription-agreement' },
      abort.signal,
      returnTo,
    )
      .then(async (value) => {
        if (abort.signal.aborted) {
          await value.destroy();
          return;
        }
        mounted = value;
        widget.current = value;
        setReady(true);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => {
      abort.abort();
      widget.current = null;
      void mounted?.destroy();
    };
  }, [order, attempt, returnTo]);

  async function pay() {
    if (!widget.current || pending) return;
    setPending(true);
    setError(false);
    try {
      const path = await widget.current.requestPayment();
      if (path) router.replace(path as Route);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return {
    ready,
    pending,
    error,
    pay,
    remount: () => {
      setReady(false);
      setError(false);
      setAttempt((value) => value + 1);
    },
  };
}
