'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { useMemo, useState } from 'react';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  decideAppeal,
  fetchPendingAppeals,
  fetchReportCase,
  fetchReportCases,
  processReportCase,
  type Appeal,
  type ReportAction,
  type ReportStatus,
  type ReportTargetType,
} from './api';

export const STATUSES = ['PENDING', 'HANDLED', 'APPEALED'] as const;
export const TARGET_TYPES = [
  'USER',
  'POST',
  'COMMENT',
  'RECRUIT_POST',
  'TEAM_MESSAGE',
  'DIRECT_MESSAGE',
  'RECRUITER_AD',
] as const;
export const STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: '대기',
  HANDLED: '처리 완료',
  APPEALED: '이의 제기',
};
export const TARGET_LABEL: Record<ReportTargetType, string> = {
  USER: '사용자',
  POST: '게시물',
  COMMENT: '댓글',
  RECRUIT_POST: '팀 모집 글',
  TEAM_MESSAGE: '팀 채팅',
  DIRECT_MESSAGE: '1:1 채팅',
  RECRUITER_AD: '채용 광고',
};
export const REASON_LABEL: Record<string, string> = {
  SPAM: '스팸',
  ABUSE: '괴롭힘·혐오',
  SEXUAL: '성적 콘텐츠',
  PRIVACY: '개인정보 노출',
  PLAGIARISM: '표절·도용',
  FAKE_RECRUIT: '허위 모집',
  IMPERSONATION: '사칭',
  ILLEGAL: '불법 행위',
  OTHER: '기타',
};

export function formatReportDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}

export function useAdminReportsView() {
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(['reports', 'appeals'] as const).withDefault('reports'),
  );
  const [status, setStatus] = useQueryState(
    'status',
    parseAsStringLiteral(STATUSES).withDefault('PENDING'),
  );
  const [targetType, setTargetType] = useQueryState(
    'targetType',
    parseAsStringLiteral(['ALL', ...TARGET_TYPES] as const).withDefault('ALL'),
  );
  const [overdue, setOverdue] = useQueryState(
    'overdue',
    parseAsStringLiteral(['true', 'false'] as const).withDefault('false'),
  );
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  const [sort, setSort] = useQueryState(
    'sort',
    parseAsStringLiteral(['newest', 'oldest'] as const).withDefault('newest'),
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [action, setAction] = useState<ReportAction | null>(null);
  const [reason, setReason] = useState('');
  const [appealId, setAppealId] = useState<number | null>(null);
  const [appealAccept, setAppealAccept] = useState<boolean | null>(null);
  const queryClient = useQueryClient();
  const confirm = useOverlay('admin-report-action');

  const listQuery = useQuery({
    queryKey: ['admin-report-cases', status, targetType, overdue],
    queryFn: () => fetchReportCases({ status, targetType, overdue }),
    enabled: tab === 'reports',
  });
  const detailQuery = useQuery({
    queryKey: ['admin-report-case', selectedId],
    queryFn: () => fetchReportCase(selectedId!),
    enabled: selectedId !== null && tab === 'reports',
  });
  const appealsQuery = useQuery({
    queryKey: ['admin-appeals'],
    queryFn: () => fetchPendingAppeals(),
    enabled: tab === 'appeals',
  });
  const processReport = useMutation({
    mutationFn: ({
      id,
      nextAction,
      note,
    }: {
      id: number;
      nextAction: ReportAction;
      note: string;
    }) => processReportCase(id, nextAction, note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-report-cases'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-report-case', selectedId] });
      toast('신고 처리를 저장했어요.');
      confirm.close();
      setAction(null);
      setReason('');
    },
    onError: (error) =>
      toast(error instanceof Error ? error.message : '신고 처리를 저장하지 못했어요.', {
        tone: 'alert',
      }),
  });
  const decideAppealMutation = useMutation({
    mutationFn: ({ id, accept, note }: { id: number; accept: boolean; note: string }) =>
      decideAppeal(id, accept, note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-appeals'] });
      toast('이의 제기 결정을 저장했어요.');
      confirm.close();
      setAppealId(null);
      setAppealAccept(null);
      setReason('');
    },
    onError: (error) =>
      toast(error instanceof Error ? error.message : '이의 제기 결정을 저장하지 못했어요.', {
        tone: 'alert',
      }),
  });

  const visibleCases = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('ko-KR');
    return [...(listQuery.data?.items ?? [])]
      .filter(
        (item) =>
          !needle ||
          `${item.id} ${item.target.name} ${item.target.login} ${item.targetSummary}`
            .toLocaleLowerCase('ko-KR')
            .includes(needle),
      )
      .sort(
        (left, right) =>
          (sort === 'newest' ? 1 : -1) *
          (Date.parse(left.receivedAt) - Date.parse(right.receivedAt)),
      );
  }, [listQuery.data?.items, search, sort]);

  const detail = detailQuery.data;
  const currentAppeal = appealsQuery.data?.items.find((item) => item.id === appealId);
  const confirmTitle =
    appealId !== null
      ? '이의 제기 결정'
      : action === 'DISMISS'
        ? '신고를 기각할까요?'
        : action === 'RESTORE'
          ? '처리된 콘텐츠를 복원할까요?'
          : action === 'DELETE'
            ? '콘텐츠를 삭제할까요?'
            : '콘텐츠를 숨길까요?';

  function askAction(nextAction: ReportAction) {
    setAction(nextAction);
    confirm.open();
  }
  function askAppeal(item: Appeal, accept: boolean) {
    setAppealId(item.id);
    setAppealAccept(accept);
    setReason('');
    confirm.open();
  }
  function confirmCurrentAction() {
    if (appealId !== null && appealAccept !== null)
      decideAppealMutation.mutate({ id: appealId, accept: appealAccept, note: reason });
    else if (selectedId !== null && action)
      processReport.mutate({ id: selectedId, nextAction: action, note: reason });
  }

  function onSearchChange(value: string) {
    void setSearch(value || null);
    setSelectedId(null);
  }
  function onStatusChange(value: ReportStatus) {
    void setStatus(value);
    setSelectedId(null);
  }
  function onTargetTypeChange(value: (typeof TARGET_TYPES)[number] | 'ALL') {
    void setTargetType(value);
    setSelectedId(null);
  }

  return {
    tab,
    setTab,
    status,
    targetType,
    overdue,
    setOverdue,
    search,
    sort,
    setSort,
    selectedId,
    setSelectedId,
    action,
    reason,
    setReason,
    appealId,
    appealAccept,
    confirm,
    listQuery,
    detailQuery,
    appealsQuery,
    processReport,
    decideAppeal: decideAppealMutation,
    visibleCases,
    detail,
    currentAppeal,
    confirmTitle,
    handlers: {
      askAction,
      askAppeal,
      confirmCurrentAction,
      onSearchChange,
      onStatusChange,
      onTargetTypeChange,
    },
  };
}
