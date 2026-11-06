'use client';

// client boundary: URL filters for append-only audit records
import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { formatDate, toKstIso } from '@/lib/format/time';

import styles from '../../../_components/admin-data.module.css';
import { AUDIT_ACTIONS, useAdminAuditView } from './hook';

export function AdminAuditView() {
  const { filters, setFilters, invalid, options, logs, rows, resetFilters } = useAdminAuditView();

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
                {AUDIT_ACTIONS[type] ?? type}
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
        <Button variant="soft" onClick={resetFilters}>
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
                  <td>{AUDIT_ACTIONS[log.actionType] ?? log.actionType}</td>
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
