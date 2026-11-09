'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { dismissToast, toast } from '@/stores/toast-store';

import { createAiSummary, waitForAiSummary, type AiChatSummary } from './api';

const TOAST_KEY = 'ai-summary';

export function useAiSummaryFab(roomId: number) {
  const panel = useOverlay('ai-summary');
  const [result, setResult] = useState<AiChatSummary | null>(null);

  const run = useMutation({
    mutationFn: async () => {
      toast('요약하는 중이에요', { key: TOAST_KEY });
      const created = await createAiSummary(roomId);
      if (created.status === 'PENDING') {
        return waitForAiSummary(roomId, created.summaryId);
      }
      return created;
    },
    onSuccess: (row) => {
      dismissToast(TOAST_KEY);
      if (row.status === 'DONE') {
        setResult(row);
        panel.open();
        return;
      }
      toast('요약하지 못했어요', { tone: 'alert', key: TOAST_KEY });
    },
    onError: (error) => {
      dismissToast(TOAST_KEY);
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        toast(error.message, { tone: 'alert', key: TOAST_KEY });
      }
      // PLAN_LIMIT / RATE_LIMITED / LOGIN_REQUIRED: shared mutation cache handler
    },
  });

  return {
    onClick: () => {
      if (run.isPending) return;
      run.mutate();
    },
    pending: run.isPending,
    panel,
    result,
  };
}
