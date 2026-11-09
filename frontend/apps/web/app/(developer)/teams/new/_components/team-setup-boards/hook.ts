'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TeamSetupBoardSaved } from '@linker/api/openAPIDefinition.schemas';
import { useViewer } from '@/lib/auth/viewer-context';
import { ISSUE_STATUSES } from '@/app/(developer)/_lib/issue-status';
import { teamKeys } from '../../../[id]/_lib/team-queries';
import type { BoardSelection } from '../../../_components/team-board-selection';
import { getListSetupBoardsQueryOptions, saveSetupBoard } from './api';

export const setupBoardKey = (login: string | null, teamId: number | null) =>
  ['team-setup', login, teamId, 'board'] as const;

export function useTeamSetupBoards(
  teamId: number | null,
  selection: BoardSelection,
  onSaved: (board: TeamSetupBoardSaved) => void,
) {
  const viewer = useViewer();
  const client = useQueryClient();
  const queryKey = ['team-setup', viewer.login, teamId, 'boards'] as const;
  const boards = useQuery(
    getListSetupBoardsQueryOptions(teamId ?? 0, {
      query: { queryKey, enabled: teamId !== null },
      request: { cache: 'no-store' },
    }),
  );
  const selected = boards.data?.items.find((board) => board.id === selection.boardId);
  // The server maps option IDs, never display names (which need not be unique).
  const mapping = Object.fromEntries(
    (selected?.statusOptions ?? [])
      .filter((option) =>
        [...ISSUE_STATUSES, 'OTHER'].some(
          (status) => status === selection.statusMapping[option.id],
        ),
      )
      .map((option) => [option.id, selection.statusMapping[option.id]!]),
  );
  const completeMapping =
    !!selected && ISSUE_STATUSES.every((s) => Object.values(mapping).includes(s));
  const mode = boards.isSuccess && !boards.data.items.length ? 'new' : selection.mode;
  const ready =
    teamId !== null &&
    boards.isSuccess &&
    !boards.isFetching &&
    (mode === 'new' || completeMapping);
  const save = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!teamId || !ready) throw new Error('보드 상태를 확인해 주세요');
      const board = await saveSetupBoard(
        teamId,
        mode === 'new'
          ? { mode: 'NEW' }
          : { mode: 'EXISTING', boardId: selected!.id, statusMapping: mapping },
        { cache: 'no-store' },
      );
      if (!board.boardId || !board.name) throw new Error('보드 연결 결과를 확인해 주세요');
      return board;
    },
    onSuccess: (board) => {
      client.setQueryData(setupBoardKey(viewer.login, teamId), board);
      void client.invalidateQueries({ queryKey: teamKeys.mine });
      void client.invalidateQueries({ queryKey, refetchType: 'none' });
      onSaved(board);
    },
    onError: () => {
      // A timed-out creation may have succeeded on GitHub. Re-list; never auto-create again.
      void boards.refetch();
    },
  });
  return { boards, selected, mode, ready: ready && !save.isPending, save };
}
