'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { todayKst } from '@/lib/format/time';
import { fetchAuditFilters, fetchAuditLogs, type AuditLog, type AuditFiltersState } from './api';

export const AUDIT_ACTIONS: Record<string, string> = {
  HIDE: '콘텐츠 숨김',
  DELETE: '콘텐츠 삭제',
  RESTORE: '콘텐츠 복구',
  SANCTION: '회원 제재',
  REVOKE: '이용 제한 해제',
  DISMISS: '신고 기각',
  VIEW_EMAIL: '이메일 열람',
  APPEAL_ACCEPT: '이의 제기 수용',
  APPEAL_REJECT: '이의 제기 기각',
  REFUND: '환불',
};
const STEPS: Record<string, string> = {
  WARNING: '경고',
  DAYS_7: '7일 이용 제한',
  DAYS_30: '30일 이용 제한',
  PERMANENT: '영구 정지',
};
export function actionLabel(log: AuditLog) {
  return log.actionType === 'SANCTION' && log.sanctionStep
    ? (STEPS[log.sanctionStep] ?? AUDIT_ACTIONS.SANCTION)
    : (AUDIT_ACTIONS[log.actionType] ?? log.actionType);
}
const TARGETS: Record<string, string> = {
  USER: '사용자',
  POST: '게시물',
  COMMENT: '댓글',
  RECRUIT_POST: '모집 글',
  MESSAGE: '메시지',
  TEAM_MESSAGE: '팀 채팅',
  DIRECT_MESSAGE: '대화',
  RECRUITER_AD: '채용 광고',
  PAYMENT: '결제',
};
export function targetLabel(log: AuditLog) {
  return log.targetId !== null
    ? `${TARGETS[log.targetType] ?? log.targetType} #${log.targetId}`
    : log.target;
}
function validDate(value: string) {
  if (!value) return true;
  const parsed = parseISO(value);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value
  );
}
export function useAdminAuditView() {
  const [filters, setFilters] = useQueryStates({
    adminId: parseAsString.withDefault(''),
    actionType: parseAsString.withDefault(''),
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
    q: parseAsString.withDefault(''),
  });
  const invalid =
    !validDate(filters.from) ||
    !validDate(filters.to) ||
    (!!filters.from && !!filters.to && filters.from > filters.to);
  const options = useQuery({
    queryKey: ['admin-audit-filters'],
    queryFn: ({ signal }) => fetchAuditFilters(signal),
  });
  const { adminId, actionType, from, to } = filters;
  const logs = useInfiniteQuery({
    queryKey: ['admin-audit', { adminId, actionType, from, to }],
    enabled: !invalid,
    initialPageParam: null as string | null,
    queryFn: ({ signal, pageParam }) =>
      fetchAuditLogs({ adminId, actionType, from, to }, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const [page, setPage] = useState(0);
  const currentPage = Math.min(page, Math.max(0, (logs.data?.pages.length ?? 1) - 1));
  const query = filters.q.trim().toLocaleLowerCase('ko-KR');
  const pageRows = logs.data?.pages[currentPage]?.items ?? [];
  const rows = pageRows
    .filter(
      (log) =>
        (!from || todayKst(new Date(log.createdAt)) >= from) &&
        (!to || todayKst(new Date(log.createdAt)) <= to),
    )
    .filter(
      (log) =>
        !query ||
        `${log.target} ${targetLabel(log)} ${log.reason ?? ''}`
          .toLocaleLowerCase('ko-KR')
          .includes(query),
    )
    .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id);
  function changeFilters(next: Partial<AuditFiltersState>) {
    setPage(0);
    void setFilters(next);
  }
  async function nextPage() {
    if (logs.isFetchingNextPage) return;
    if (currentPage < (logs.data?.pages.length ?? 0) - 1) setPage(currentPage + 1);
    else if (logs.hasNextPage) {
      const result = await logs.fetchNextPage();
      if (!result.isError) setPage(currentPage + 1);
    }
  }
  return {
    filters,
    changeFilters,
    invalid,
    options,
    logs,
    rows,
    page: currentPage,
    hasNext: currentPage < (logs.data?.pages.length ?? 0) - 1 || logs.hasNextPage,
    search: (value: string) => void setFilters({ q: value }),
    previousPage: () => setPage(Math.max(0, currentPage - 1)),
    nextPage,
    resetFilters: () => {
      setPage(0);
      void setFilters({ adminId: '', actionType: '', from: '', to: '', q: '' });
    },
  };
}
