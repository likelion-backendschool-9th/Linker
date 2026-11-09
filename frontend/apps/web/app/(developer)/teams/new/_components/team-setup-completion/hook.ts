'use client';

import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TeamSetupProgress } from '@linker/api/openAPIDefinition.schemas';
import { useRef } from 'react';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import { teamKeys } from '../../../[id]/_lib/team-queries';
import { checkSetupPermission, completeTeamSetup } from './api';

export const setupCompletionKey = (login: string | null, teamId: number | null) =>
  ['team-setup', login, teamId, 'complete'] as const;

function accepted(result: TeamSetupProgress | undefined) {
  return (
    !!result &&
    (result.state === 'COMPLETED' ||
      (result.queued === true && (result.state === 'QUEUED' || result.state === 'RUNNING')))
  );
}

class SetupProgressError extends Error {
  constructor(readonly state: TeamSetupProgress['state']) {
    super(
      state === 'FAILED'
        ? '동기화에 실패했어요. 다시 시도해 주세요.'
        : '연결 정보를 다시 확인해 주세요.',
    );
  }
}

export function useTeamSetupCompletion(teamId: number | null, onComplete?: () => void) {
  const continuing = useRef(false);
  const client = useQueryClient();
  const viewer = useViewer();
  const key = setupCompletionKey(viewer.login, teamId);
  const result = useQuery<TeamSetupProgress>({ queryKey: key, queryFn: skipToken });
  // Reuse B's team action key; the sheet stays local to page 08.
  const overlay = useOverlay('team-settings-action');
  const openExternal = useOpenExternal();
  const complete = useMutation({
    retry: false,
    mutationFn: async (retry: boolean) => {
      if (!teamId) throw new Error('GitHub 조직을 먼저 연결해 주세요.');
      const progress = await completeTeamSetup(teamId, { retry }, { cache: 'no-store' });
      if (!accepted(progress)) throw new SetupProgressError(progress.state);
      return progress;
    },
    onSuccess: (progress) => {
      client.setQueryData(key, progress);
      void client.invalidateQueries({ queryKey: teamKeys.mine });
      onComplete?.();
    },
  });
  const permission = useMutation<Awaited<ReturnType<typeof checkSetupPermission>>, Error, boolean>({
    retry: false,
    mutationFn: async () => {
      if (!teamId) throw new Error('GitHub 조직을 먼저 연결해 주세요.');
      const data = await checkSetupPermission(teamId, { cache: 'no-store' });
      if (!['READ', 'NONE', 'WRITE', 'ADMIN'].includes(data.basePermission))
        throw new Error('GitHub 조직 기본 권한을 확인해 주세요');
      return data;
    },
    onSuccess: (data, retry) => {
      if (data.basePermission === 'READ' || data.basePermission === 'NONE') {
        overlay.open(`setup-permission-${teamId}`);
      } else if (data.basePermission === 'WRITE' || data.basePermission === 'ADMIN') {
        complete.mutate(retry);
      }
    },
  });
  const pending = permission.isPending || complete.isPending;
  return {
    done: accepted(result.data),
    pending,
    error: permission.error ?? complete.error,
    permission: permission.data,
    overlay,
    openExternal,
    start: () => {
      if (!pending)
        permission.mutate(
          complete.error instanceof SetupProgressError && complete.error.state === 'FAILED',
        );
    },
    continue: () => {
      if (!pending && permission.data && !continuing.current) {
        continuing.current = true;
        void overlay
          .closeAnd(() => complete.mutateAsync(permission.variables ?? false))
          .catch(() => undefined)
          .finally(() => {
            continuing.current = false;
          });
      }
    },
  };
}
