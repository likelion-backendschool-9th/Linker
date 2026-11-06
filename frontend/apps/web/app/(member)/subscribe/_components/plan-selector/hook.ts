'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { useState } from 'react';

import { useViewer } from '@/lib/auth/viewer-context';

import {
  createCheckout,
  plansOptions,
  teamCandidatesOptions,
  type CheckoutOrder,
} from './api';

export const REASONS: Record<string, string> = {
  'photo-limit': '더 많은 사진을 올리고 싶으신가요?',
  PHOTO_LIMIT: '더 많은 사진을 올리고 싶으신가요?',
  AI_SUMMARY: '팀 대화 요약이 필요하신가요?',
  'ai-summary': '팀 대화 요약이 필요하신가요?',
  'team-members': '팀 인원 제한 없이 함께하려면 Flex를 확인해 보세요.',
  stats: '작업물의 유입 경로와 채용 담당자 조회 수를 확인해 보세요.',
};

export function usePlanSelector(reason: string) {
  const { login, role, status } = useViewer();
  const recruiter = role === 'recruiter';
  const plans = useQuery(plansOptions(login, reason));
  const teams = useQuery({ ...teamCandidatesOptions(login), enabled: !recruiter });
  const [billing, setBilling] = useQueryState(
    'billing',
    parseAsStringLiteral(['MONTHLY', 'YEARLY'] as const).withDefault('MONTHLY'),
  );
  const [teamId, setTeamId] = useQueryState('teamId', parseAsString.withDefault(''));
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const checkout = useMutation({ mutationFn: createCheckout, onSuccess: setOrder });
  const selectedTeam = teams.data?.items.find((team) => String(team.teamId) === teamId);

  return {
    login,
    status,
    recruiter,
    plans,
    teams,
    billing,
    setBilling,
    teamId,
    setTeamId,
    order,
    setOrder,
    checkout,
    selectedTeam,
  };
}
