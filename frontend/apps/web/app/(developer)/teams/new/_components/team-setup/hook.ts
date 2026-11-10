'use client';

import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  TeamCreatedResponse,
  VerifyInstallationResponse,
} from '@linker/api/openAPIDefinition.schemas';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useViewer } from '@/lib/auth/viewer-context';
import {
  createdSetupTeamKey,
  isInstalledOrganization,
  verifiedInstallationKey,
} from '../../_lib/installation';
import { teamKeys } from '../../../[id]/_lib/team-queries';

import { useOpenExternal } from '@/features/external-link/use-open-external';
import { resolveSetupStep } from '../../_lib/setup-steps';
export { STEPS } from '../../_lib/setup-steps';

import { useTeamSetupCompletion } from '../team-setup-completion/hook';
import type { BoardSelection } from '../../../_components/team-board-selection';
import { myTeamsOptions, createTeam, updateSetupTeamInfo } from './api';

type CreatedSetupTeam = TeamCreatedResponse & { installationId: string; description: string };

export function useTeamSetup() {
  const [flow, setFlow] = useQueryStates({
    step: parseAsInteger.withDefault(1),
    teamId: parseAsInteger,
  });
  const step = resolveSetupStep(flow.step);
  const setupTeamId =
    flow.teamId !== null && Number.isSafeInteger(flow.teamId) && flow.teamId > 0
      ? flow.teamId
      : null;
  const setStep = (value: number, options?: Parameters<typeof setFlow>[1]) =>
    setFlow({ step: value }, options);
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState('');
  const viewer = useViewer();
  const installation = useQuery<VerifyInstallationResponse>({
    queryKey: verifiedInstallationKey(viewer.login),
    queryFn: skipToken,
  });
  const created = useQuery<CreatedSetupTeam>({
    queryKey: createdSetupTeamKey(viewer.login),
    queryFn: skipToken,
  });
  const [selectedRepos, setSelectedRepos] = useState<number[]>([]);
  const [boardDraft, setBoardDraft] = useState<BoardSelection>({
    mode: 'existing',
    boardId: '',
    statusMapping: {},
  });
  const teams = useQuery(myTeamsOptions());
  const finish = useTeamSetupCompletion(setupTeamId, () => void setStep(5, { history: 'push' }));
  const displayName = nameTouched
    ? name
    : isInstalledOrganization(installation.data)
      ? installation.data.org.login
      : '';
  const atLimit = teams.data ? teams.data.teamCount >= teams.data.teamLimit : false;
  const openExternal = useOpenExternal();

  const create = useMutation({
    mutationFn: async () => {
      const installed = installation.data;
      if (!isInstalledOrganization(installed)) throw new Error('GitHub 조직을 먼저 연결해 주세요.');
      const info = { name: displayName.trim(), description: description.trim() };
      const existing = created.data;
      if (existing?.installationId === installed.installationId) {
        if (existing.name !== info.name || existing.description !== info.description) {
          await updateSetupTeamInfo(existing.id, info);
        }
        return { ...existing, ...info };
      }
      const result = await createTeam(
        { installationId: installed.installationId, ...info },
        { cache: 'no-store' },
      );
      if (!Number.isSafeInteger(result.id) || result.id <= 0)
        throw new Error('팀 정보를 확인해 주세요');
      return { ...result, ...info, installationId: installed.installationId };
    },
    onSuccess: (result) => {
      client.setQueryData(createdSetupTeamKey(viewer.login), result);
      void client.invalidateQueries({ queryKey: teamKeys.mine });
      void setFlow({ step: 3, teamId: result.id }, { history: 'push' });
    },
  });

  return {
    step,
    setStep,
    setupTeamId,
    create,
    finish,
    installed: isInstalledOrganization(installation.data) ? installation.data : undefined,
    name,
    setName,
    setNameTouched,
    description,
    setDescription,
    selectedRepos,
    setSelectedRepos,
    boardDraft,
    setBoardDraft,
    teams,
    displayName,
    atLimit,
    openExternal,
  };
}
