'use client';

import { useQuery } from '@tanstack/react-query';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useState } from 'react';

import { useOpenExternal } from '@/features/external-link/use-open-external';
import { resolveSetupStep } from '../../_lib/setup-steps';
export { STEPS } from '../../_lib/setup-steps';

import type { BoardSelection } from '../../../_components/team-board-selection';
import {
  myTeamsOptions,
  settingsOptions,
  setupBoardsOptions,
  setupPermissionOptions,
  setupReposOptions,
} from './api';

export const STATUSES = [
  '작업 전 · Todo',
  '작업 중 · In Progress',
  '작업 중단 · Blocked',
  '작업 완료 · Done',
];

export function useTeamSetup() {
  const [value, setStep] = useQueryState('step', parseAsInteger.withDefault(1));
  const step = resolveSetupStep(value);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState('');
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
  const repos = useQuery({
    ...setupReposOptions(previewTeamId),
    enabled: !!previewTeam && step === 3,
  });
  const boards = useQuery({
    ...setupBoardsOptions(previewTeamId),
    enabled: !!previewTeam && step === 4,
  });
  const permission = useQuery({
    ...setupPermissionOptions(previewTeamId),
    enabled: !!previewTeam && step === 5,
  });
  const displayName = nameTouched ? name : (previewTeam?.orgLogin ?? '');
  const boardSummary =
    boardDraft.mode === 'new'
      ? '새 Linker 보드'
      : (boards.data?.items.find((board) => board.id === boardDraft.boardId)?.name ?? '기존 보드');
  const atLimit = teams.data ? teams.data.teamCount >= teams.data.teamLimit : false;
  const openExternal = useOpenExternal();

  function selectPreviewTeam(teamId: string) {
    setPreviewTeamId(teamId);
    setSelectedRepos([]);
    setBoardDraft({ mode: 'new', boardId: '', statusMapping: {} });
  }

  return {
    step,
    setStep,
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
    repos,
    boards,
    permission,
    displayName,
    boardSummary,
    atLimit,
    openExternal,
  };
}
