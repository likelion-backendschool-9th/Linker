'use client';

import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';

import { useOverlay } from '@/lib/navigation/use-overlay';

import { adminUserOptions, type AdminUserDetail } from './api';

export const ACTION_TITLES: Record<string, string> = {
  email: '이메일 열람 사유',
  sanction: '사용자 제재',
  lift: '제재를 해제할까요?',
  refund: '결제를 환불할까요?',
};

export function useAdminUserActionSheet() {
  const overlay = useOverlay('admin-user-action');
  const [kind = '', userId, paymentId] = (overlay.id ?? '').split(':');
  const user = useQuery({
    ...adminUserOptions(userId ?? null),
    enabled: overlay.isOpen && !!userId,
  });

  return {
    overlay,
    kind,
    userId,
    paymentId,
    user,
  };
}

export function useAdminActionForm({
  user,
  kind,
  paymentId,
}: {
  user: AdminUserDetail;
  kind: string;
  paymentId?: string;
}) {
  const [error, setError] = useState(false);
  const [checked, setChecked] = useState(false);
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [refundError, setRefundError] = useState(false);
  const confirmation = useRef<HTMLInputElement>(null);
  const reason = useRef<HTMLTextAreaElement>(null);
  const payment = user.payments.find((item) => String(item.id) === paymentId);
  const reasonLabel =
    kind === 'email'
      ? '열람 사유'
      : kind === 'lift'
        ? '해제 사유'
        : kind === 'refund'
          ? '환불 사유'
          : '제재 사유';
  const denied =
    (kind === 'lift' && !user.allowedActions.liftSanction) ||
    (kind === 'refund' && (!user.allowedActions.refund || !payment || payment.status !== 'PAID'));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = !reason.current?.value.trim();
    const consentInvalid = kind === 'refund' && !refundConfirmed;
    setError(invalid);
    setRefundError(consentInvalid);
    setChecked(!invalid && !consentInvalid);
    if (invalid) reason.current?.focus();
    else if (consentInvalid) confirmation.current?.focus();
  }

  function onRefundConfirmChange(next: boolean) {
    setRefundConfirmed(next);
    setRefundError(false);
    setChecked(false);
  }

  function onReasonChange() {
    setError(false);
    setChecked(false);
  }

  return {
    error,
    checked,
    refundConfirmed,
    refundError,
    confirmation,
    reason,
    payment,
    reasonLabel,
    denied,
    handlers: {
      onSubmit,
      onRefundConfirmChange,
      onReasonChange,
    },
  };
}
