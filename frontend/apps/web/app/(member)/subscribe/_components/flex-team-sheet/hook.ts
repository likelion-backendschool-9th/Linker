'use client';

import { useState, type FormEvent } from 'react';

import type { TeamCandidate } from './api';

/** The chosen team stays a draft in the sheet until "Flex 결제 준비"; a team handed off by 29 (`?teamId=`) is preselected only when it is one of the permitted candidates. */
export function useFlexTeamSheet({
  teams,
  initialTeamId,
  onSubmit,
}: {
  teams: TeamCandidate[] | undefined;
  initialTeamId: string;
  onSubmit: (teamId: number) => void;
}) {
  const [draft, setDraft] = useState('');
  const handedOff = teams?.find((team) => String(team.teamId) === initialTeamId);
  const selectedId = draft || (handedOff ? initialTeamId : '');
  const forged = !!initialTeamId && !!teams && !handedOff;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (selectedId) onSubmit(Number(selectedId));
  }

  return { selectedId, setDraft, forged, submit };
}
