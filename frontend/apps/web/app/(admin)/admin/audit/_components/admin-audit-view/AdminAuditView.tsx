'use client';

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Search,
  UserRound,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { toKst, toKstIso } from '@/lib/format/time';
import { actionLabel, AUDIT_ACTIONS, targetLabel, useAdminAuditView } from './hook';
import styles from './AdminAuditView.module.css';

export function AdminAuditView() {
  const {
    filters,
    changeFilters,
    invalid,
    options,
    logs,
    rows,
    page,
    hasNext,
    search,
    previousPage,
    nextPage,
    resetFilters,
  } = useAdminAuditView();
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1 id="page-title">운영 로그</h1>
        <p>운영자의 조치와 사유를 확인하세요.</p>
      </div>
      <p className={styles.notice}>
        <LockKeyhole size={18} aria-hidden />
        운영 기록은 수정하거나 삭제할 수 없습니다.
      </p>
      <div className={styles.filters}>
        <fieldset className={styles.period}>
          <legend className="sr-only">기간 선택</legend>
          <CalendarDays size={20} aria-hidden />
          <span>기간</span>
          <label className="sr-only" htmlFor="audit-from">
            시작일 (KST)
          </label>
          <input
            id="audit-from"
            type="date"
            value={filters.from}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'audit-range-error' : undefined}
            onChange={(e) => changeFilters({ from: e.target.value })}
          />
          <span aria-hidden>—</span>
          <label className="sr-only" htmlFor="audit-to">
            종료일 (KST)
          </label>
          <input
            id="audit-to"
            type="date"
            value={filters.to}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'audit-range-error' : undefined}
            onChange={(e) => changeFilters({ to: e.target.value })}
          />
        </fieldset>
        <label className="sr-only" htmlFor="audit-admin">
          운영자
        </label>
        <select
          id="audit-admin"
          value={filters.adminId}
          disabled={options.isPending || options.isError}
          onChange={(e) => changeFilters({ adminId: e.target.value })}
        >
          <option value="">운영자 전체</option>
          {options.data?.admins.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="audit-action">
          조치 유형
        </label>
        <select
          id="audit-action"
          value={filters.actionType}
          disabled={options.isPending || options.isError}
          onChange={(e) => changeFilters({ actionType: e.target.value })}
        >
          <option value="">조치 전체</option>
          {options.data?.actionTypes.map((type) => (
            <option key={type} value={type}>
              {AUDIT_ACTIONS[type] ?? type}
            </option>
          ))}
        </select>
        <button type="button" className={styles.reset} onClick={resetFilters}>
          초기화
        </button>
      </div>
      {invalid && (
        <p className={styles.error} id="audit-range-error" role="alert">
          종료일은 시작일 이후로 선택해 주세요.
        </p>
      )}
      {options.isError && (
        <ErrorState title="필터를 불러오지 못했어요" onRetry={() => void options.refetch()} />
      )}
      <div className={styles.searchRow}>
        <div className={styles.search}>
          <Search size={20} aria-hidden />
          <label className="sr-only" htmlFor="audit-search">
            대상 또는 사유 검색
          </label>
          <input
            id="audit-search"
            type="search"
            placeholder="대상 또는 사유 검색"
            value={filters.q}
            onChange={(e) => search(e.target.value)}
            aria-describedby="audit-search-scope"
          />
        </div>
        <p className={styles.meta} id="audit-search-scope">
          현재 페이지 {invalid ? 0 : rows.length}건
        </p>
      </div>
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
        <div className={styles.tableWrap} role="region" aria-label="조치 기록 표" tabIndex={0}>
          <table className={styles.table}>
            <caption className="sr-only">운영자 조치 기록 · 최신순 · 한국 표준시</caption>
            <thead>
              <tr>
                <th scope="col">시각</th>
                <th scope="col">운영자</th>
                <th scope="col">대상</th>
                <th scope="col">조치</th>
                <th scope="col">사유</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log) => (
                <tr key={log.id}>
                  <td>
                    <time dateTime={toKstIso(log.createdAt)}>
                      {format(toKst(log.createdAt), 'yyyy.MM.dd')}
                      <br />
                      {format(toKst(log.createdAt), 'HH:mm')}
                    </time>
                  </td>
                  <td>
                    <div className={styles.person}>
                      <span className={styles.icon}>
                        <UserRound size={20} aria-hidden />
                      </span>
                      <span>
                        <strong>{log.admin}</strong>
                        <span className={styles.identifier}>#{log.adminId}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.person}>
                      <span className={styles.icon}>
                        {log.targetType === 'USER' ? (
                          <UserRound size={20} aria-hidden />
                        ) : (
                          <FileText size={20} aria-hidden />
                        )}
                      </span>
                      <strong>{targetLabel(log)}</strong>
                    </div>
                  </td>
                  <td>
                    <span className={styles.badge} data-warning={log.actionType === 'SANCTION'}>
                      {actionLabel(log)}
                    </span>
                  </td>
                  <td className={styles.reason}>{log.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.footer}>
        <p>모든 시각은 KST 기준입니다.</p>
        <nav className={styles.pagination} aria-label="운영 로그 페이지">
          <button
            type="button"
            aria-label="이전 페이지"
            disabled={page === 0 || invalid}
            onClick={previousPage}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span aria-current="page">{page + 1}</span>
          <button
            type="button"
            aria-label="다음 페이지"
            disabled={!hasNext || invalid || logs.isFetchingNextPage}
            onClick={() => void nextPage()}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </nav>
      </div>
      {logs.isFetchNextPageError && (
        <ErrorState title="추가 기록을 불러오지 못했어요" onRetry={() => void nextPage()} />
      )}
    </div>
  );
}
