'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsInteger, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useEffect, useRef, useState } from 'react';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { useStompSubscription } from '@/lib/realtime/use-stomp';
import { fetchPullRequests } from './api';

export type PullRequestSheetProps = {
  roomId: number;
  login: string | null;
  disabled?: boolean;
  /** The parent supplies its existing chat outbox; this screen never owns a second queue. */
  onShare?: (url: string) => void;
};

const pullRequestKey = (roomId: number, login: string | null) =>
  ['chat', login, 'room', roomId, 'pull-requests'] as const;

/** Mounted by the open dialog only; reuse the shared socket without touching D's receiver. */
export function usePullRequestLiveUpdates({
  roomId,
  login,
}: Pick<PullRequestSheetProps, 'roomId' | 'login'>) {
  const client = useQueryClient();
  const listKey = pullRequestKey(roomId, login);
  useStompSubscription<{
    event?: string;
    message?: { type?: string; roomId?: number };
  }>(
    `/topic/chat-rooms/${roomId}`,
    (event) => {
      if (
        event?.event === 'MESSAGE' &&
        event.message?.type === 'PR_EVENT' &&
        event.message.roomId === roomId
      )
        void client.invalidateQueries({ queryKey: listKey });
    },
    {
      onResubscribe: () => {
        void client.invalidateQueries({ queryKey: listKey });
      },
    },
  );
}

export function usePullRequestSheet({
  roomId,
  login,
  disabled = false,
  onShare,
}: PullRequestSheetProps) {
  const overlay = useOverlay('chat-pull-requests');
  const [{ pr: state, selectedPr }, setParameters] = useQueryStates({
    pr: parseAsStringLiteral(['open', 'merged'] as const).withDefault('open'),
    selectedPr: parseAsInteger,
  });
  const external = useOpenExternal();
  const [shareError, setShareError] = useState(false);
  const sharing = useRef(false);
  const query = useQuery({
    queryKey: [...pullRequestKey(roomId, login), state],
    queryFn: ({ signal }) => fetchPullRequests(roomId, state, signal),
    enabled: overlay.isOpen,
    staleTime: 0,
  });
  const items = query.isError ? [] : (query.data?.items ?? []);
  const selected = items.find((pr) => pr.id === selectedPr);
  useEffect(() => {
    if (!overlay.isOpen) sharing.current = false;
  }, [overlay.isOpen]);
  const canShare =
    !disabled && !!onShare && !!selected && !query.isFetching && !query.isPending && !query.isError;
  function share() {
    if (!canShare || !selected || !onShare || sharing.current) return;
    sharing.current = true;
    setShareError(false);
    try {
      onShare(selected.url);
      overlay.close();
    } catch {
      sharing.current = false;
      setShareError(true);
    }
  }
  return {
    overlay,
    state,
    query,
    items,
    selected,
    external,
    canShare,
    shareError,
    setState: (state: 'open' | 'merged') => {
      setShareError(false);
      void setParameters({ pr: state, selectedPr: null });
    },
    select: (id: number) => {
      setShareError(false);
      void setParameters({ selectedPr: id });
    },
    share,
  };
}
