'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  aiSummaryKey,
  createAiSummary,
  getAiSummary,
  shareAiSummary,
  type AiChatSummary,
} from './api';

const TOAST_KEY = 'ai-summary';
/** Server progress is polled while a summary is PENDING (no realtime path for it). */
const POLL_MS = 2000;

/**
 * Ring on the "AI 채팅 요약" button (POL-C-5): idle → queued (spinning) → running (blue fill) →
 * done (full blue until shared or replaced) / failed (red until summarized again).
 */
export type AiSummaryRing =
  | { state: 'idle' }
  | { state: 'queued'; queueAhead: number }
  | {
      state: 'running';
      phase: 'READING' | 'WRITING';
      progress: number;
      remainingSeconds: number | null;
    }
  | { state: 'done' }
  | { state: 'failed' };

export function ringOf(summary: AiChatSummary | undefined): AiSummaryRing {
  if (!summary || summary.sharedMessageId) return { state: 'idle' };
  if (summary.status === 'DONE') return { state: 'done' };
  if (summary.status === 'FAILED') return { state: 'failed' };
  if (summary.phase === 'READING' || summary.phase === 'WRITING') {
    return {
      state: 'running',
      phase: summary.phase,
      progress: summary.progress,
      remainingSeconds: summary.remainingSeconds,
    };
  }
  return { state: 'queued', queueAhead: summary.queueAhead };
}

type Args = {
  roomId: number;
  /** From room info: the latest unshared summary, so the ring resumes after leaving the room */
  initial: { summaryId: number; status: string } | null | undefined;
};

export function useAiSummaryFab({ roomId, initial }: Args) {
  const queryClient = useQueryClient();
  const panel = useOverlay('ai-summary');
  const renewConfirm = useOverlay('ai-summary-renew');
  const [summaryId, setSummaryId] = useState<number | null>(initial?.summaryId ?? null);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  // Progress reached 100 at some point we watched; drives the one-off done/failed toast
  const watched = useRef<number | null>(null);

  // A notification link opens the sheet as ?overlay=ai-summary&oid={summaryId}
  const linkedId = panel.isOpen && panel.id ? Number(panel.id) : null;
  const [followedLink, setFollowedLink] = useState<number | null>(null);
  if (linkedId && Number.isSafeInteger(linkedId) && linkedId !== followedLink) {
    // Adjusting state while rendering (react.dev "You Might Not Need an Effect")
    setFollowedLink(linkedId);
    setSummaryId(linkedId);
  }

  const summary = useQuery({
    queryKey: aiSummaryKey(roomId, summaryId ?? 0),
    queryFn: () => getAiSummary(roomId, summaryId!),
    enabled: summaryId !== null,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? POLL_MS : false),
    refetchIntervalInBackground: true,
  });
  const current = summary.data;
  const ring = ringOf(current);

  useEffect(() => {
    if (!current) return;
    if (current.status === 'PENDING') {
      watched.current = current.summaryId;
      return;
    }
    if (watched.current !== current.summaryId) return;
    watched.current = null;
    setBubbleOpen(false);
    if (current.status === 'DONE') {
      toast('요약이 끝났어요', {
        tone: 'success',
        key: TOAST_KEY,
        action: { label: '보기', onClick: () => panel.open(String(current.summaryId)) },
      });
    } else {
      toast('요약하지 못했어요', { tone: 'error', key: TOAST_KEY });
    }
  }, [current, panel]);

  const start = useMutation({
    mutationFn: () => createAiSummary(roomId),
    onSuccess: (created) => {
      queryClient.setQueryData(aiSummaryKey(roomId, created.summaryId), created);
      watched.current = created.summaryId;
      setSummaryId(created.summaryId);
    },
    onError: (error) => {
      // PLAN_LIMIT (Flex sheet), RATE_LIMITED and LOGIN_REQUIRED go through the shared handler
      if (
        error instanceof ApiError &&
        ['VALIDATION_ERROR', 'SERVICE_UNAVAILABLE'].includes(error.code)
      ) {
        toast(error.message, { tone: 'error', key: TOAST_KEY });
      }
    },
  });

  const share = useMutation({
    mutationFn: () => shareAiSummary(roomId, summaryId!),
    onSuccess: (message) => {
      if (summaryId !== null) {
        queryClient.setQueryData<AiChatSummary>(aiSummaryKey(roomId, summaryId), (old) =>
          old ? { ...old, sharedMessageId: message.id } : old,
        );
      }
      panel.close();
      toast('채팅에 공유했어요', { tone: 'success', key: TOAST_KEY });
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.code !== 'PLAN_LIMIT' &&
        error.code !== 'LOGIN_REQUIRED'
      ) {
        toast(error.message, { tone: 'error', key: TOAST_KEY });
      }
    },
  });

  function onClick() {
    if (start.isPending) return;
    switch (ring.state) {
      case 'queued':
      case 'running':
        setBubbleOpen((open) => !open);
        return;
      case 'done':
        panel.open(String(current!.summaryId));
        return;
      default:
        // idle or failed: a new summary (a failed one gave its use back)
        start.mutate();
    }
  }

  return {
    ring,
    summary: current ?? null,
    onClick,
    starting: start.isPending,
    bubbleOpen,
    closeBubble: () => setBubbleOpen(false),
    panel,
    renewConfirm,
    share: () => {
      if (!share.isPending) share.mutate();
    },
    sharing: share.isPending,
    /** "새로 요약하기" in the sheet opens the confirm (it spends one use); the confirm replaces the sheet */
    askRenew: () => renewConfirm.open(),
    renew: () => {
      void renewConfirm.closeAnd(() => start.mutate());
    },
  };
}
