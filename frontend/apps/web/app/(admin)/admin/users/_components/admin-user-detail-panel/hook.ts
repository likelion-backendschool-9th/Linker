'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useOverlay } from '@/lib/navigation/use-overlay';
import type { ActionDraft } from '../admin-user-action-sheet/api';
import { adminUserOptions } from './api';
export { SANCTION_LABELS } from '../../_lib/admin-user-queries';

export function useAdminUserDetailPanel(
  userId: string,
  onDraft?: (draft: ActionDraft) => void,
  draft?: ActionDraft,
) {
  const query = useQuery(adminUserOptions(userId));
  const action = useOverlay('admin-user-action');
  const [tab, setTab] = useQueryState(
    'userTab',
    parseAsStringLiteral(['basic', 'sanctions', 'reports', 'payments'] as const).withDefault(
      'basic',
    ),
  );
  const [step, setStep] = useState(draft?.userId === userId ? draft.step : '');
  const [reason, setReason] = useState(draft?.userId === userId ? draft.reason : '');
  const [reasonError, setReasonError] = useState(false);
  return {
    query,
    action,
    tab,
    setTab,
    step,
    setStep,
    reason,
    setReason,
    reasonError,
    handlers: {
      openRefund: (id: number) => action.open(`refund:${userId}:${id}`),
      openEmail: () => action.open(`email:${userId}`),
      apply() {
        if (!reason.trim()) {
          setReasonError(true);
          return;
        }
        if (step) {
          onDraft?.({ userId, step, reason });
          action.open(`sanction:${userId}`);
        }
      },
      openLift: () => action.open(`lift:${userId}`),
      onStepChange(value: string) {
        setStep(value);
        onDraft?.({ userId, step: value, reason });
      },
      onReasonChange(value: string) {
        setReason(value);
        onDraft?.({ userId, step, reason: value });
        setReasonError(false);
      },
      clearDraft() {
        setStep('');
        setReason('');
      },
    },
  };
}
