'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';

import { todayKst } from '@/lib/format/time';

import { fetchAuditFilters, fetchAuditLogs } from './api';

export const AUDIT_ACTIONS: Record<string, string> = {
  REPORT_HIDE: '신고 콘텐츠 숨김',
  REPORT_DELETE: '신고 콘텐츠 삭제',
  SANCTION_WARNING: '경고',
  SANCTION_DAYS_7: '7일 이용 제한',
  SANCTION_DAYS_30: '30일 이용 제한',
  SANCTION_PERMANENT: '영구 정지',
  SANCTION_LIFT: '제재 해제',
  EMAIL_REVEAL: '이메일 열람',
  HIDE: '숨김',
  DELETE: '삭제',
  RESTORE: '복원',
  DISMISS: '신고 기각',
};

export function useAdminAuditView() {
  const [filters, setFilters] = useQueryStates({
    adminId: parseAsString.withDefault(''),
    actionType: parseAsString.withDefault(''),
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
  });
  const invalid = !!filters.from && !!filters.to && filters.from > filters.to;
  const options = useQuery({
    queryKey: ['admin-audit-filters'],
    queryFn: ({ signal }) => fetchAuditFilters(signal),
  });
  const logs = useInfiniteQuery({
    queryKey: ['admin-audit', filters],
    enabled: !invalid,
    initialPageParam: null as string | null,
    queryFn: ({ signal, pageParam }) => fetchAuditLogs(filters, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const rows = (logs.data?.pages.flatMap((page) => page.items) ?? [])
    .filter(
      (log) =>
        (!filters.from || todayKst(new Date(log.createdAt)) >= filters.from) &&
        (!filters.to || todayKst(new Date(log.createdAt)) <= filters.to),
    )
    .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return {
    filters,
    setFilters,
    invalid,
    options,
    logs,
    rows,
    resetFilters: () => void setFilters({ adminId: '', actionType: '', from: '', to: '' }),
  };
}
