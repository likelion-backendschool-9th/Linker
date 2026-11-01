'use client';

// client boundary: URL filters for append-only audit records
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/api-fetch';
import { formatDate, todayKst, toKstIso } from '@/lib/format/time';

import styles from '../../_components/admin-data.module.css';

type AuditLog = {
  id: number;
  admin: string;
  actionType: string;
  target: string;
  reason: string;
  createdAt: string;
};
const ACTIONS: Record<string, string> = {
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

export function AdminAuditView() {
  const [filters, setFilters] = useQueryStates({
    adminId: parseAsString.withDefault(''),
    actionType: parseAsString.withDefault(''),
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
  });
  const invalid = !!filters.from && !!filters.to && filters.from > filters.to;
  const options = useQuery({
    queryKey: ['admin-audit-filters'],
    queryFn: ({ signal }) =>
      apiFetch<{ admins: { id: string; name: string }[]; actionTypes: string[] }>(
        '/api/v1/admin/audit-logs/filters',
        { signal },
      ),
  });
  const logs = useInfiniteQuery({
    queryKey: ['admin-audit', filters],
    enabled: !invalid,
    initialPageParam: null as string | null,
    queryFn: ({ signal, pageParam }) => {
      const params = new URLSearchParams();
      if (filters.adminId) params.set('adminId', filters.adminId);
      if (filters.actionType) params.set('actionType', filters.actionType);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (pageParam) params.set('cursor', pageParam);
      params.set('size', '20');
      return apiFetch<{ items: AuditLog[]; nextCursor: string | null }>(
        `/api/v1/admin/audit-logs?${params}`,
        { signal },
      );
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const rows = (logs.data?.pages.flatMap((page) => page.items) ?? [])
    .filter(
      (log) =>
        (!filters.from || todayKst(new Date(log.createdAt)) >= filters.from) &&
        (!filters.to || todayKst(new Date(log.createdAt)) <= filters.to),
    )
    .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <div className={styles.page}>
      <div className={styles.section}>
        <h1 id="page-title" className={styles.title}>
          운영 · 조치 기록
        </h1>
        <p className={styles.note}>
          누가, 언제, 어떤 조치를 했는지 확인해요. 기록은 수정하거나 삭제할 수 없어요.
        </p>
      </div>
      <div className={styles.filters}>
        <div className={styles.field}>
          <label htmlFor="audit-admin">운영자</label>
          <select
            id="audit-admin"
            className={styles.input}
            value={filters.adminId}
            onChange={(e) => void setFilters({ adminId: e.target.value })}
          >
            <option value="">전체 운영자</option>
            {options.data?.admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-action">조치 유형</label>
          <select
            id="audit-action"
            className={styles.input}
            value={filters.actionType}
            onChange={(e) => void setFilters({ actionType: e.target.value })}
          >
            <option value="">전체 조치</option>
            {options.data?.actionTypes.map((type) => (
              <option key={type} value={type}>
                {ACTIONS[type] ?? type}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-from">시작일 (KST)</label>
          <input
            id="audit-from"
            className={styles.input}
            type="date"
            value={filters.from}
            onChange={(e) => void setFilters({ from: e.target.value })}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'audit-range-error' : undefined}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-to">종료일 (KST)</label>
          <input
            id="audit-to"
            className={styles.input}
            type="date"
            value={filters.to}
            onChange={(e) => void setFilters({ to: e.target.value })}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'audit-range-error' : undefined}
          />
        </div>
      </div>
      {invalid && (
        <p id="audit-range-error" role="alert" className={styles.warning}>
          종료일은 시작일 이후로 선택해 주세요.
        </p>
      )}
      <div className={styles.heading}>
        <p className={styles.note}>조치 기록 {invalid ? 0 : rows.length}건</p>
        <Button
          variant="soft"
          onClick={() => void setFilters({ adminId: '', actionType: '', from: '', to: '' })}
        >
          필터 초기화
        </Button>
      </div>
      {options.isError && (
        <ErrorState title="필터를 불러오지 못했어요" onRetry={() => void options.refetch()} />
      )}
      {logs.isPending && !invalid ? (
        <Skeleton variant="card" />
      ) : logs.isError && !logs.data ? (
        <ErrorState onRetry={() => void logs.refetch()} />
      ) : invalid || !rows.length ? (
        <EmptyState
          title="조건에 맞는 조치 기록이 없어요."
          description="필터와 기간을 확인해 주세요."
        />
      ) : (
        <div className={styles.scroll} role="region" aria-label="조치 기록 표" tabIndex={0}>
          <table className={styles.table}>
            <caption>운영자 조치 기록 · 최신순 · 한국 표준시</caption>
            <thead>
              <tr>
                <th scope="col">운영자</th>
                <th scope="col">일시</th>
                <th scope="col">대상</th>
                <th scope="col">조치</th>
                <th scope="col">사유</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log) => (
                <tr key={log.id}>
                  <td>{log.admin}</td>
                  <td>
                    <time dateTime={log.createdAt}>
                      {formatDate(log.createdAt)} {toKstIso(log.createdAt).slice(11, 16)}
                    </time>
                  </td>
                  <td>{log.target}</td>
                  <td>{ACTIONS[log.actionType] ?? log.actionType}</td>
                  <td>{log.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {logs.isFetchNextPageError && (
        <ErrorState
          title="추가 기록을 불러오지 못했어요"
          onRetry={() => void logs.fetchNextPage()}
        />
      )}
      {!invalid && logs.hasNextPage && (
        <Button
          variant="outline"
          disabled={logs.isFetchingNextPage}
          onClick={() => void logs.fetchNextPage()}
        >
          {logs.isFetchingNextPage ? '불러오는 중…' : '더 보기'}
        </Button>
      )}
    </div>
  );
}
