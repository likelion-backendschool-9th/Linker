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

import type { BoardSelection } from '../../../_components/team-board-selection';
import {
  myTeamsOptions,
  settingsOptions,
  setupBoardsOptions,
  setupPermissionOptions,
  createTeam,
  updateSetupTeamInfo,
} from './api';

type CreatedSetupTeam = TeamCreatedResponse & { installationId: string; description: string };

export const STATUSES = [
  '작업 전 · Todo',
  '작업 중 · In Progress',
  '작업 중단 · Blocked',
  '작업 완료 · Done',
];

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
  const [previewTeamId, setPreviewTeamId] = useState('');
  const [selectedRepos, setSelectedRepos] = useState<number[]>([]);
  const [completePreview, setCompletePreview] = useState(false);
  const [boardDraft, setBoardDraft] = useState<BoardSelection>({
    mode: 'new',
    boardId: '',
    statusMapping: {},
  });
  const teams = useQuery(myTeamsOptions());
  const ownedTeams =
    teams.data?.items.filter((team) => team.myRole === 'OWNER' && team.status === 'ACTIVE') ?? [];
  const previewSource = ownedTeams.find((team) => String(team.id) === previewTeamId);
  const previewSettings = useQuery({ ...settingsOptions(previewTeamId), enabled: !!previewSource });
  const previewTeam = previewSettings.data;
  const boards = useQuery({
    ...setupBoardsOptions(previewTeamId),
    enabled: !!previewTeam && step === 4,
  });
  const permission = useQuery({
    ...setupPermissionOptions(previewTeamId),
    enabled: !!previewTeam && step === 5,
  });
  const displayName = nameTouched
    ? name
    : isInstalledOrganization(installation.data)
      ? installation.data.org.login
      : '';
  const boardSummary =
    boardDraft.mode === 'new'
      ? '새 Linker 보드'
      : (boards.data?.items.find((board) => board.id === boardDraft.boardId)?.name ?? '기존 보드');
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

  function selectPreviewTeam(teamId: string) {
    setPreviewTeamId(teamId);
    setSelectedRepos([]);
    setBoardDraft({ mode: 'new', boardId: '', statusMapping: {} });
  }

  return {
    step,
    setStep,
    setupTeamId,
    create,
    installed: isInstalledOrganization(installation.data) ? installation.data : undefined,
    name,
    setName,
    setNameTouched,
    description,
    setDescription,
    previewTeamId,
    selectPreviewTeam,
    selectedRepos,
    setSelectedRepos,
    completePreview,
    setCompletePreview,
    boardDraft,
    setBoardDraft,
    teams,
    ownedTeams,
    previewSettings,
    previewTeam,
    boards,
    permission,
    displayName,
    boardSummary,
    atLimit,
    openExternal,
  };
}
