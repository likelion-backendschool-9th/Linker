'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { deleteTeam, type TeamSettings } from './api';

export function useTeamDeleteDialog(team: TeamSettings) {
  const overlay = useOverlay('team-delete');
  const client = useQueryClient();
  const viewer = useViewer();
  const router = useRouter();
  const [confirmName, setConfirmName] = useState('');
  const canDelete =
    team.permissions.deleteTeam &&
    viewer.status !== 'SUSPENDED' &&
    !['READ_ONLY', 'ARCHIVED'].includes(team.status);
  const mutation = useMutation({
    mutationFn: (name: string) => {
      if (!canDelete || name !== team.name) throw new Error('팀 이름을 정확히 입력해 주세요');
      return deleteTeam(team.id, { confirmName: name });
    },
    onSuccess: () => overlay.closeAnd(() => router.replace('/workspace')),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['team-settings', String(team.id)] }),
        client.invalidateQueries({ queryKey: ['teams', 'mine'] }),
        client.invalidateQueries({ queryKey: ['chat'] }),
      ]),
  });
  function onOpenChange(next: boolean) {
    if (mutation.isPending) return;
    setConfirmName('');
    mutation.reset();
    overlay.onOpenChange(next);
  }
  return {
    overlay,
    onOpenChange,
    confirmName,
    setConfirmName,
    canDelete,
    mutation,
    canConfirm: canDelete && confirmName === team.name && !mutation.isPending,
  };
}
