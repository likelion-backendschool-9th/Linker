'use client';

import { AddBoldIcon } from '@solar-icons/static/bold/add';
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { Icon } from '@/components/ui/icon';

import { toRecruitCardData, type MyApplication } from '../../_lib/list-queries';
import { RecruitCard } from '../recruit-card';
import { RecruitFilterSheet } from '../recruit-filter-sheet';
import { RecruitSearchPanel } from '../recruit-search-panel';
import { RecruitTabs } from '../recruit-tabs';
import { TabChromeCollapseEffect } from '../../../_components/tab-chrome-collapse';
import { useLoadMoreSentinel, useRecruitList } from './hook';
import styles from './RecruitList.module.css';

/** 19 recruit list (Figma 254:2124). Filter/sort sheets are scenario 5 (Figma 352:958). */
export function RecruitList() {
  const {
    tab,
    selectTab,
    loginNeeded,
    promptLogin,
    filterOverlay,
    search,
    selectedFilters,
    chipFilters,
    searchActive,
    resetSearch,
    applyFilter,
    recruits,
    applications,
    count,
    sortLabel,
    query,
    promptWrite,
    isGuest,
  } = useRecruitList();

  const loadMoreRef = useLoadMoreSentinel(
    Boolean(query.hasNextPage) && !query.isFetchingNextPage && !query.isError,
    query.isFetchingNextPage,
    () => void query.fetchNextPage(),
  );

  return (
    <div className={styles.page}>
      <TabChromeCollapseEffect />
      <div className={styles.chromeSlot}>
        <div className={styles.chromeSticky} data-tab-chrome>
          <RecruitTabs tab={tab} onSelect={selectTab} />
          {tab === 'all' && (
            <RecruitSearchPanel
              filterOverlay={filterOverlay}
              search={search}
              selectedFilters={chipFilters}
              pinned={searchActive}
              onReset={resetSearch}
            />
          )}
        </div>
      </div>

      {loginNeeded ? (
        <div className={styles.empty}>
          <p>로그인하면 내 모집글과 지원 내역을 볼 수 있어요.</p>
          <Button onClick={promptLogin}>로그인</Button>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <p className={styles.count}>
              총 <span className={styles.countNumber}>{count}개</span>의{' '}
              {tab === 'applied' ? '지원' : '모집글'}
            </p>
            {tab === 'all' && (
              <button
                type="button"
                className={styles.sort}
                aria-haspopup="dialog"
                aria-expanded={filterOverlay.isOpen && filterOverlay.id === 'sort'}
                onClick={() => filterOverlay.open('sort')}
              >
                {sortLabel}
                <Icon svg={AltArrowDownLinearIcon} className={styles.sortIcon} />
              </button>
            )}
          </div>

          {query.isPending ? (
            <p className={styles.empty}>불러오는 중…</p>
          ) : query.isError ? (
            <div className={styles.empty}>
              <p>목록을 불러오지 못했어요.</p>
              <Button variant="soft" onClick={() => void query.refetch()}>
                다시 시도
              </Button>
            </div>
          ) : tab === 'applied' ? (
            applications.length === 0 ? (
              // Writing lives on the FAB, so an empty tab is just a quiet line
              <p className={styles.emptyNotice}>지원한 게시물이 없습니다</p>
            ) : (
              <ul className={styles.list}>
                {applications.map((application) => (
                  <ApplicationRow key={application.id} application={application} />
                ))}
              </ul>
            )
          ) : recruits.length === 0 ? (
            tab === 'all' ? (
              <p className={styles.empty}>필터를 줄여 보세요</p>
            ) : (
              <p className={styles.emptyNotice}>팀을 모으고 있지 않아요</p>
            )
          ) : (
            <ul className={styles.list}>
              {recruits.map((recruit) => (
                <li key={recruit.id}>
                  <RecruitCard recruit={recruit} />
                </li>
              ))}
            </ul>
          )}

          <div ref={loadMoreRef} className={styles.sentinel} aria-hidden />
          {query.isFetchingNextPage && <p className={styles.empty}>더 불러오는 중…</p>}
        </>
      )}

      <div className={styles.fabLayer}>
        {isGuest ? (
          <button type="button" className={styles.fab} onClick={promptWrite}>
            <span className={styles.fabVisual}>
              <Icon svg={AddBoldIcon} className={styles.fabIcon} />
            </span>
            <span className="sr-only">모집글 쓰기</span>
          </button>
        ) : (
          <Link href="/recruits/new" className={styles.fab}>
            <span className={styles.fabVisual}>
              <Icon svg={AddBoldIcon} className={styles.fabIcon} />
            </span>
            <span className="sr-only">모집글 쓰기</span>
          </Link>
        )}
      </div>

      <RecruitFilterSheet
        overlay={filterOverlay}
        selected={selectedFilters}
        onApply={applyFilter}
      />
    </div>
  );
}

/** "내 지원" tab: just the post I applied to (no role/status line or actions); cancel lives on 21 */
function ApplicationRow({ application }: { application: MyApplication }) {
  return (
    <li>
      <RecruitCard recruit={toRecruitCardData(application.recruit)} />
    </li>
  );
}
