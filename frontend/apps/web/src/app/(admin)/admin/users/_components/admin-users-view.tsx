'use client';

// client boundary: URL filters, row selection, and mobile detail overlay
import { useInfiniteQuery } from '@tanstack/react-query';
import { Search, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useOverlay } from '@/lib/navigation/use-overlay';

import styles from '../../_components/admin-data.module.css';
import { adminUsersOptions } from '../_lib/admin-user-queries';
import { AdminUserDetailPanel } from './admin-user-detail-panel';
import { AdminUserActionSheet } from './admin-user-action-sheet';

export function AdminUsersView() {
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(''),
    status: parseAsStringLiteral(['', 'ACTIVE', 'SUSPENDED', 'WITHDRAWING'] as const).withDefault(
      '',
    ),
    userType: parseAsStringLiteral(['', 'DEVELOPER', 'RECRUITER'] as const).withDefault(''),
    needsReview: parseAsBoolean.withDefault(false),
    user: parseAsString,
  });
  const users = useInfiniteQuery(adminUsersOptions(filters));
  const items = users.data?.pages.flatMap((page) => page.items) ?? [];
  const desktop = useMediaQuery('(min-width: 1024px)');
  const overlay = useOverlay('admin-user-detail');
  const selected = overlay.id ?? filters.user;
  function select(id: number) {
    if (desktop) void setFilters({ user: String(id) });
    else overlay.open(String(id));
  }
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <div className={styles.section}>
          <h1 id="page-title" className={styles.title}>
            운영 · 회원 관리
          </h1>
          <p className={styles.note}>회원 정보를 확인하고 이용 상태를 관리해요.</p>
        </div>
        <span className={styles.badge}>
          <ShieldCheck size={16} aria-hidden />
          운영자 전용
        </span>
      </div>
      <p className={styles.note}>
        화면 미리보기 단계예요. 제재·해제·이메일 열람·환불은 실행되지 않아요.
      </p>
      <div className={styles.filters}>
        <div className={styles.field}>
          <label htmlFor="admin-user-search">이름 또는 GitHub 아이디</label>
          <input
            id="admin-user-search"
            type="search"
            className={styles.input}
            value={filters.q}
            placeholder="이름, @아이디 검색"
            onChange={(e) => void setFilters({ q: e.target.value, user: null })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="admin-user-status">회원 상태</label>
          <select
            id="admin-user-status"
            className={styles.input}
            value={filters.status}
            onChange={(e) =>
              void setFilters({ status: e.target.value as typeof filters.status, user: null })
            }
          >
            <option value="">전체</option>
            <option value="ACTIVE">활동 중</option>
            <option value="SUSPENDED">이용 제한</option>
            <option value="WITHDRAWING">탈퇴 대기</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="admin-user-type">회원 유형</label>
          <select
            id="admin-user-type"
            className={styles.input}
            value={filters.userType}
            onChange={(e) =>
              void setFilters({ userType: e.target.value as typeof filters.userType, user: null })
            }
          >
            <option value="">전체</option>
            <option value="DEVELOPER">개발자</option>
            <option value="RECRUITER">채용 담당자</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="admin-user-review">검토 여부</label>
          <select
            id="admin-user-review"
            className={styles.input}
            value={String(filters.needsReview)}
            onChange={(e) =>
              void setFilters({ needsReview: e.target.value === 'true', user: null })
            }
          >
            <option value="false">전체</option>
            <option value="true">확인 필요</option>
          </select>
        </div>
      </div>
      <div className={styles.heading}>
        <p className={styles.note}>
          <Search size={16} aria-hidden />
          불러온 회원 {items.length}명
        </p>
        <Button
          variant="soft"
          onClick={() =>
            void setFilters({ q: '', status: '', userType: '', needsReview: false, user: null })
          }
        >
          필터 초기화
        </Button>
      </div>
      {users.isPending ? (
        <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
          <Skeleton variant="card" count={3} />
        </LoadingIndicator>
      ) : users.isError && !users.data ? (
        <ErrorState onRetry={() => void users.refetch()} />
      ) : (
        <div className={styles.columns}>
          <div className={styles.list}>
            {items.length ? (
              <ul>
                {items.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      className={styles.userRow}
                      aria-pressed={selected === String(user.id)}
                      onClick={() => select(user.id)}
                    >
                      <Image
                        className={styles.avatar}
                        src={user.avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        sizes="40px"
                      />
                      <span className={styles.identity}>
                        <span className={styles.name}>{user.name}</span>
                        <span className={styles.meta}>@{user.login}</span>
                        <span className={styles.meta}>{user.emailMasked}</span>
                      </span>
                      <span className={styles.trailing}>
                        <span className={styles.badge}>
                          {user.userType === 'DEVELOPER' ? '개발자' : '채용 담당자'}
                        </span>
                        {user.needsReview && <span className={styles.warning}>확인 필요</span>}
                        <span className={styles.meta}>
                          {user.status === 'ACTIVE'
                            ? '활동 중'
                            : user.status === 'SUSPENDED'
                              ? '이용 제한'
                              : '탈퇴 대기'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="조건에 맞는 회원이 없어요."
                description="검색어나 필터를 바꿔 보세요."
              />
            )}
          </div>
          <aside className={`${styles.detail} ${styles.desktopDetail}`} aria-label="회원 상세">
            {desktop && selected ? (
              <AdminUserDetailPanel key={selected} userId={selected} />
            ) : (
              <EmptyState
                title="회원을 선택해 주세요."
                description="목록에서 회원을 선택하면 상세 정보가 표시돼요."
              />
            )}
          </aside>
        </div>
      )}
      {users.isFetchNextPageError && (
        <ErrorState
          title="추가 회원을 불러오지 못했어요"
          onRetry={() => void users.fetchNextPage()}
        />
      )}
      {users.hasNextPage && (
        <Button
          variant="outline"
          disabled={users.isFetchingNextPage}
          onClick={() => void users.fetchNextPage()}
          pending={users.isFetchingNextPage}
          pendingLabel="불러오는 중…"
        >
          더 보기
        </Button>
      )}
      {!desktop && (
        <OverlaySheet
          overlay={overlay}
          title="회원 상세"
          description="회원 정보와 이용 내역을 확인해요."
        >
          {overlay.isOpen && overlay.id && (
            <AdminUserDetailPanel key={overlay.id} userId={overlay.id} />
          )}
        </OverlaySheet>
      )}
      <AdminUserActionSheet />
    </div>
  );
}
