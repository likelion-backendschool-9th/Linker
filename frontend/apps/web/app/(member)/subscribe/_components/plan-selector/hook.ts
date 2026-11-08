'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { useState } from 'react';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { createCheckout, plansOptions, teamCandidatesOptions, type CheckoutOrder } from './api';

/** Keys are the server's PLAN_LIMIT `detail.reason` values plus the links that open 28 directly. */
export const REASONS: Record<string, string> = {
  'photo-limit': '더 많은 사진을 올리고 싶으신가요?',
  PHOTO_LIMIT: '더 많은 사진을 올리고 싶으신가요?',
  POST_PHOTOS: '더 많은 사진을 올리고 싶으신가요?',
  RECRUIT_POSTS: '모집 글을 더 많이 열어 두고 싶으신가요?',
  AI_SUMMARY: '팀 대화 요약이 필요하신가요?',
  'ai-summary': '팀 대화 요약이 필요하신가요?',
  PROGRESS_GRAPH: '팀 진행 현황 그래프가 필요하신가요?',
  'team-members': '팀 인원 제한 없이 함께하려면 Flex를 확인해 보세요.',
  teams: '팀 인원 제한 없이 함께하려면 Flex를 확인해 보세요.',
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
  // Read only: 29 hands a team off with ?teamId=, and the sheet preselects it when permitted.
  const [teamId] = useQueryState('teamId', parseAsString.withDefault(''));
  const flexTeam = useOverlay('subscribe-flex-team');
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const checkout = useMutation({
    mutationFn: createCheckout,
    onSuccess: (next) => {
      if (flexTeam.isOpen) flexTeam.close();
      setOrder(next);
    },
  });

  return {
    status,
    recruiter,
    plans,
    teams,
    billing,
    setBilling,
    teamId,
    flexTeam,
    order,
    setOrder,
    checkout,
  };
}
