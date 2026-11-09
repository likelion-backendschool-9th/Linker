'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';
import {
  adminUserOptions,
  liftSanction,
  revealEmail,
  sanctionUser,
  type ActionDraft,
  type AdminUserDetail,
} from './api';

export const ACTION_TITLES: Record<string, string> = {
  email: '이메일 열람 사유',
  sanction: '사용자 제재',
  lift: '제재를 해제할까요?',
  refund: '결제를 환불할까요?',
};
export function useAdminUserActionSheet() {
  const overlay = useOverlay('admin-user-action');
  const [kind = '', userId, paymentId] = (overlay.id ?? '').split(':');
  const validId = !!userId && /^\d+$/.test(userId);
  const user = useQuery({
    ...adminUserOptions(validId ? userId : null),
    enabled: overlay.isOpen && validId,
  });
  return { overlay, kind, userId, paymentId, user, validId };
}
export function useAdminActionForm({
  user,
  kind,
  paymentId,
  draft,
  close,
  onApplied,
}: {
  user: AdminUserDetail;
  kind: string;
  paymentId?: string;
  draft?: ActionDraft;
  close: () => void;
  onApplied?: () => void;
}) {
  const client = useQueryClient();
  const [reason, setReason] = useState(
    draft?.userId === String(user.id) && kind === 'sanction' ? draft.reason : '',
  );
  const [step, setStep] = useState(
    draft?.userId === String(user.id) && kind === 'sanction' ? draft.step : 'WARNING',
  );
  const activeSanctions = user.sanctions.filter(
    (s) => s.active && ['WARNING', 'DAYS_7', 'DAYS_30', 'PERMANENT'].includes(s.step),
  );
  const [sanctionId, setSanctionId] = useState(String(activeSanctions[0]?.id ?? ''));
  const [confirmed, setConfirmed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const payment = user.payments.find((p) => String(p.id) === paymentId);
  // The existing refund endpoint does not accept an operator-entered reason. Do not discard it.
  const denied =
    kind === 'refund' ||
    !['sanction', 'email', 'lift'].includes(kind) ||
    (kind === 'lift' && (!user.allowedActions.liftSanction || !activeSanctions.length)) ||
    (kind === 'sanction' && step === 'PERMANENT' && !user.allowedActions.permanentSanction);
  const mutation = useMutation({
    gcTime: 0,
    throwOnError: false,
    retry: false,
    mutationFn: async () => {
      if (denied) throw new Error('허용되지 않은 조치예요.');
      if (kind === 'email') return revealEmail(String(user.id), reason);
      if (kind === 'sanction') await sanctionUser(String(user.id), step, reason);
      else await liftSanction(String(user.id), sanctionId);
      return null;
    },
    onSuccess: async () => {
      if (kind === 'email') return; // Full email exists only in this mounted dialog, never the user query.
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin-user', String(user.id)] }),
        client.invalidateQueries({ queryKey: ['admin-users'] }),
        client.invalidateQueries({ queryKey: ['admin-audit'] }),
      ]);
      toast(kind === 'lift' ? '제재가 해제됐어요.' : '제재가 적용됐어요.');
      onApplied?.();
      close();
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending || mutation.isSuccess || denied) return;
    const missing = kind === 'lift' ? !confirmed : !reason.trim();
    setInvalid(missing);
    if (missing) {
      if (kind === 'lift') confirmationRef.current?.focus();
      else reasonRef.current?.focus();
      return;
    }
    mutation.mutate();
  }
  return {
    reason,
    setReason,
    step,
    setStep,
    sanctionId,
    setSanctionId,
    activeSanctions,
    confirmed,
    setConfirmed,
    invalid,
    setInvalid,
    reasonRef,
    confirmationRef,
    payment,
    denied,
    mutation,
    submit,
  };
}
