'use client';

import { ChevronLeft, ChevronRight, Search, UserRound } from 'lucide-react';
import Image from 'next/image';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { STATUS_LABELS } from '../../_lib/admin-user-queries';
import { AdminUserActionSheet } from '../admin-user-action-sheet';
import { AdminUserDetailPanel } from '../admin-user-detail-panel';
import { useAdminUsersView } from './hook';
import styles from './AdminUsersView.module.css';

export function AdminUsersView() {
  const {
    filters,
    changeFilters,
    users,
    items,
    desktop,
    overlay,
    selected,
    reviewSupported,
    page,
    hasNext,
    handlers,
    draft,
    setDraft,
    revision,
    action,
  } = useAdminUsersView();
  const selectedStatus = filters.needsReview ? 'REVIEW' : filters.status;
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1 id="page-title">사용자 관리</h1>
        <p>사용자 상태와 제재 이력을 확인하세요.</p>
      </div>
      <div className={styles.filters}>
        <div className={styles.search}>
          <Search aria-hidden size={20} />
          <label htmlFor="admin-user-search" className="sr-only">
            이름, 아이디 검색
          </label>
          <input
            id="admin-user-search"
            type="search"
            maxLength={100}
            placeholder="이름, 아이디 검색"
            value={filters.q}
            onChange={(e) => changeFilters({ q: e.target.value })}
          />
        </div>
        <div className={styles.segments} role="group" aria-label="회원 상태">
          {(
            [
              ['', '전체'],
              ['ACTIVE', '활성'],
              ['SUSPENDED', '정지'],
              ['WITHDRAWING', '삭제 대기'],
              ['REVIEW', '검토'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={selectedStatus === value}
              disabled={value === 'REVIEW' && !reviewSupported}
              title={
                value === 'REVIEW' && !reviewSupported
                  ? '확인 필요 판정·해제 기준 합의 후 제공됩니다.'
                  : undefined
              }
              onClick={() =>
                changeFilters({
                  status: value === 'REVIEW' ? '' : value,
                  needsReview: value === 'REVIEW',
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.typeFilter}>
          <label htmlFor="admin-user-type">계정 유형</label>
          <select
            id="admin-user-type"
            value={filters.userType}
            onChange={(e) => changeFilters({ userType: e.target.value as typeof filters.userType })}
          >
            <option value="">전체</option>
            <option value="DEVELOPER">개발자</option>
            <option value="RECRUITER">리크루터</option>
          </select>
        </div>
      </div>
      {users.isPending ? (
        <Skeleton variant="card" count={2} />
      ) : users.isError && !users.data ? (
        <ErrorState onRetry={() => void users.refetch()} />
      ) : (
        <div className={styles.columns}>
          <section className={styles.listPanel} aria-labelledby="user-list-title">
            <h2 id="user-list-title">
              사용자 목록 <span className={styles.count}>{items.length}</span>
            </h2>
            {items.length ? (
              <table className={styles.table}>
                <caption className="sr-only">사용자 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">사용자</th>
                    <th scope="col">계정유형</th>
                    <th scope="col">상태</th>
                    <th scope="col">
                      <span className="sr-only">상세</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((user) => (
                    <tr key={user.id} data-selected={selected === String(user.id)}>
                      <td>
                        <button
                          type="button"
                          className={styles.userButton}
                          aria-pressed={selected === String(user.id)}
                          onClick={() => handlers.select(user.id)}
                        >
                          {user.avatarUrl ? (
                            <Image
                              className={styles.avatar}
                              src={user.avatarUrl}
                              alt=""
                              width={40}
                              height={40}
                              sizes="40px"
                            />
                          ) : (
                            <span className={styles.avatarFallback}>
                              <UserRound aria-hidden size={22} />
                            </span>
                          )}
                          <span>
                            <strong>{user.name}</strong>{' '}
                            <span className={styles.meta}>@{user.login}</span>
                          </span>
                        </button>
                      </td>
                      <td>{user.userType === 'DEVELOPER' ? '개발자' : '리크루터'}</td>
                      <td>
                        <span className={styles.status} data-status={user.status}>
                          <span aria-hidden />
                          {user.needsReview ? '검토' : STATUS_LABELS[user.status]}
                        </span>
                      </td>
                      <td>
                        <ChevronRight size={18} aria-hidden />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="조건에 맞는 회원이 없어요."
                description="검색어나 필터를 바꿔 보세요."
              />
            )}
            <nav className={styles.pagination} aria-label="사용자 목록 페이지">
              <button
                type="button"
                aria-label="이전 페이지"
                disabled={page === 0}
                onClick={handlers.previousPage}
              >
                <ChevronLeft size={18} aria-hidden />
              </button>
              <span aria-current="page">{page + 1}</span>
              <button
                type="button"
                aria-label="다음 페이지"
                disabled={!hasNext || users.isFetchingNextPage}
                onClick={() => void handlers.nextPage()}
              >
                <ChevronRight size={18} aria-hidden />
              </button>
            </nav>
            {users.isFetchNextPageError && (
              <ErrorState
                title="추가 회원을 불러오지 못했어요"
                onRetry={() => void handlers.nextPage()}
              />
            )}
          </section>
          {desktop && (
            <aside className={styles.detailPanel} aria-label="회원 상세">
              {selected ? (
                <AdminUserDetailPanel
                  key={`${selected}:${revision}`}
                  userId={selected}
                  onDraft={setDraft}
                  draft={draft}
                />
              ) : (
                <EmptyState title="회원을 선택해 주세요." />
              )}
            </aside>
          )}
        </div>
      )}
      {!desktop && (
        <OverlaySheet
          overlay={overlay}
          title="회원 상세"
          description="사용자 상태와 제재 이력을 확인하세요."
        >
          {overlay.isOpen && overlay.id && (
            <AdminUserDetailPanel
              key={overlay.id}
              userId={overlay.id}
              onDraft={setDraft}
              draft={draft}
            />
          )}
        </OverlaySheet>
      )}
      {action.isOpen && <AdminUserActionSheet draft={draft} onApplied={handlers.onApplied} />}
    </div>
  );
}
