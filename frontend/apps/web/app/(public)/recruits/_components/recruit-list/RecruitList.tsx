'use client';

// Client boundary: URL tab, sort and filters, infinite scroll, application cancel, guest login prompts
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { Plus, SlidersHorizontal, X } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import {
  RECRUIT_SORTS,
  RECRUIT_TABS,
  type RecruitFilters,
  type RecruitSort,
} from '../../_lib/recruit-filters';
import type { Page } from '../../_lib/recruit-list-queries';
import { ApplicationCard } from '../application-card';
import { RecruitCard } from '../recruit-card';
import styles from './RecruitList.module.css';
import {
  RECRUIT_TAB_LABELS,
  useActiveFilterChips,
  useAllRecruits,
  useMyApplications,
  useMyRecruits,
  usePagedList,
  useRecruitList,
  useWriteRecruitButton,
} from './hook';

const SORT_LABELS: Record<RecruitSort, string> = { NEWEST: '최신순', DEADLINE: '마감 임박순' };
const NEW_RECRUIT = '/recruits/new' as Route;

/**
 * 19 Recruit post list (07 TODO 19, POL-R-2). Guests see every tab but only 전체 opens; the other tabs
 * and "모집 글 쓰기" show the login prompt. Recruiters arrive by link only and get the list without tabs.
 */
export function RecruitList() {
  const { recruiter, tab, selectTab } = useRecruitList();

  return (
    <>
      {!recruiter && (
        <div role="group" aria-label="모집 글 보기" className={styles.tabs}>
          {RECRUIT_TABS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={tab === item}
              className={styles.tab}
              onClick={() => selectTab(item)}
            >
              {RECRUIT_TAB_LABELS[item]}
            </button>
          ))}
        </div>
      )}

      {tab === 'all' && <AllRecruits />}
      {tab === 'mine' && <MyRecruits />}
      {tab === 'applied' && <MyApplications />}

      {!recruiter && <WriteButton />}
    </>
  );
}

/** "모집 글 쓰기" → 20; a floating pill above the bottom tabs */
function WriteButton() {
  const { isGuest, promptLogin } = useWriteRecruitButton();
  const label = (
    <>
      <Plus aria-hidden />
      모집 글 쓰기
    </>
  );
  return (
    <div className={styles.write}>
      {isGuest ? (
        <Button onClick={promptLogin}>{label}</Button>
      ) : (
        <Button asChild>
          <Link href={NEW_RECRUIT}>{label}</Link>
        </Button>
      )}
    </div>
  );
}

function AllRecruits() {
  const { filters, setFilters, recruits, filterCount, openFilters } = useAllRecruits();

  return (
    <section aria-label="모집 중인 글" className={styles.panel}>
      <div className={styles.toolbar}>
        <div role="group" aria-label="정렬" className={styles.sorts}>
          {RECRUIT_SORTS.map((sort) => (
            <button
              key={sort}
              type="button"
              aria-pressed={filters.sort === sort}
              className={styles.sort}
              onClick={() => void setFilters({ sort })}
            >
              {SORT_LABELS[sort]}
            </button>
          ))}
        </div>
        <Button variant="soft" onClick={openFilters}>
          <SlidersHorizontal aria-hidden />
          {filterCount > 0 ? `필터 ${filterCount}` : '필터'}
        </Button>
      </div>

      {filterCount > 0 && (
        <ActiveFilters filters={filters} onClear={(patch) => void setFilters(patch)} />
      )}

      <PagedList
        query={recruits}
        label="모집 글"
        empty={
          filterCount > 0 ? (
            <EmptyState title="조건에 맞는 모집 글이 없어요." description="필터를 줄여 보세요." />
          ) : (
            <EmptyState
              title="지금 모집 중인 글이 없어요."
              description="모집 글을 써서 함께할 팀원을 찾아 보세요."
            />
          )
        }
        renderItem={(recruit) => <RecruitCard recruit={recruit} />}
      />
    </section>
  );
}

type FilterPatch = Partial<Pick<RecruitFilters, 'role' | 'tech' | 'mode'>>;

/** Each applied filter as a removable pill under the toolbar */
function ActiveFilters({
  filters,
  onClear,
}: {
  filters: RecruitFilters;
  onClear: (patch: FilterPatch) => void;
}) {
  const applied = useActiveFilterChips(filters);

  return (
    <ul aria-label="적용한 필터" className={styles.applied}>
      {applied.map((item) => (
        <li key={item.key}>
          <button type="button" className={styles.appliedChip} onClick={() => onClear(item.patch)}>
            <span aria-hidden>{item.label}</span>
            <X aria-hidden className={styles.appliedIcon} />
            <span className="sr-only">{item.label} 필터 해제</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MyRecruits() {
  const recruits = useMyRecruits();
  return (
    <section aria-label="내 모집 글" className={styles.panel}>
      <PagedList
        query={recruits}
        label="내 모집 글"
        empty={
          <EmptyState
            title="아직 쓴 모집 글이 없어요."
            description="모집 글을 쓰면 여기에서 모아 볼 수 있어요."
          />
        }
        renderItem={(recruit) => <RecruitCard recruit={recruit} />}
      />
    </section>
  );
}

function MyApplications() {
  const {
    applications,
    cancel,
    confirm,
    cancelPending,
    suspended,
    openCancel,
    confirmCancel,
  } = useMyApplications();

  return (
    <section aria-label="내 지원" className={styles.panel}>
      {cancel.isError && (
        <ErrorState title="지원을 취소하지 못했어요" description="잠시 후 다시 시도해 주세요." />
      )}
      <PagedList
        query={applications}
        label="내 지원"
        empty={
          <EmptyState
            title="아직 지원한 모집 글이 없어요."
            description="마음에 드는 모집 글에 지원해 보세요."
          />
        }
        renderItem={(application) => (
          <ApplicationCard
            application={application}
            disabled={cancelPending || suspended}
            onCancel={() => openCancel(application.id)}
          />
        )}
      />
      <ConfirmDialog
        overlay={confirm}
        title="지원을 취소할까요?"
        description="취소한 모집 글에는 한 번만 다시 지원할 수 있어요."
        confirmLabel="지원 취소"
        destructive
        pending={cancelPending}
        onConfirm={confirmCancel}
      />
    </section>
  );
}

type PagedListProps<T extends { id: number }> = {
  query: UseInfiniteQueryResult<InfiniteData<Page<T>>>;
  /** Names the list for screen readers */
  label: string;
  empty: ReactNode;
  renderItem: (item: T) => ReactNode;
};

/** Loading, error, empty, card grid and infinite scroll ending in "더 보기" (blueprint §6-5) */
function PagedList<T extends { id: number }>({
  query,
  label,
  empty,
  renderItem,
}: PagedListProps<T>) {
  const { items, sentinel, hasNextPage, isFetchingNextPage, fetchNextPage } = usePagedList(query);

  if (query.isPending) {
    return (
      <div aria-busy="true">
        <p role="status" className="sr-only">
          {label}을 불러오고 있어요.
        </p>
        <Skeleton count={3} />
      </div>
    );
  }
  if (query.isError && !query.data) return <ErrorState onRetry={() => void query.refetch()} />;
  if (items.length === 0) return empty;

  return (
    <>
      <ul aria-label={`${label} 목록`} className={styles.grid}>
        {items.map((item) => (
          <li key={item.id}>{renderItem(item)}</li>
        ))}
      </ul>
      {query.isError && (
        <ErrorState title="목록을 더 불러오지 못했어요" onRetry={() => void query.refetch()} />
      )}
      {hasNextPage && (
        <>
          <div ref={sentinel} aria-hidden />
          <Button variant="soft" block disabled={isFetchingNextPage} onClick={fetchNextPage}>
            {isFetchingNextPage ? '불러오는 중…' : '더 보기'}
          </Button>
        </>
      )}
    </>
  );
}
