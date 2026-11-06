'use client';

import { useQuery } from '@tanstack/react-query';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { useOpenExternal } from '@/features/external-link/use-open-external';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { fetchPullRequests } from './api';

export function usePullRequestSheet({ roomId, login }: { roomId: number; login: string | null }) {
  const overlay = useOverlay('chat-pull-requests');
  const [state, setState] = useQueryState(
    'pr',
    parseAsStringLiteral(['open', 'merged'] as const).withDefault('open'),
  );
  const external = useOpenExternal();
  const query = useQuery({
    queryKey: ['chat', login, 'room', roomId, 'pull-requests', state],
    queryFn: ({ signal }) => fetchPullRequests(roomId, state, signal),
    enabled: overlay.isOpen,
    staleTime: 0,
  });

  return { overlay, state, setState, external, query };
}
