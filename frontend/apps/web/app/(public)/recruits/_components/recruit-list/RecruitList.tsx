'use client';

import { AddBoldIcon } from '@solar-icons/static/bold/add';
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import type { Route } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { Icon } from '@/components/ui/icon';

import { toRecruitCardData, type MyApplication } from '../../_lib/list-queries';
import { RecruitCard } from '../recruit-card';
import { RecruitFilterSheet } from '../recruit-filter-sheet';
import { RecruitSearchPanel } from '../recruit-search-panel';
import { RecruitTabs } from '../recruit-tabs';
import { TabChromeCollapseEffect } from '../../../_components/tab-chrome-collapse';
import { useCancelApplication, useLoadMoreSentinel, useRecruitList } from './hook';
import styles from './RecruitList.module.css';

const APPLICATION_COPY: Record<MyApplication['status'], string> = {
  PENDING: '검토 중',
  ACCEPTED: '팀 채팅 바로가기',
  REJECTED: '이번엔 함께하지 못하게 됐어요',
  EXPIRED: '모집이 끝났어요',
};

/** 19 recruit list (Figma 254:2124). Filter/sort sheets are scenario 5 (Figma 352:958). */
export function RecruitList() {
  const {
    tab,
    selectTab,
    loginNeeded,
    promptLogin,
    filterOverlay,
    selectedFilters,
    chipFilters,
    handleSelect,
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
            <RecruitSearchPanel filterOverlay={filterOverlay} selectedFilters={chipFilters} />
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
              <p className={styles.empty}>지원한 모집글이 없어요.</p>
            ) : (
              <ul className={styles.list}>
                {applications.map((application) => (
                  <ApplicationRow key={application.id} application={application} />
                ))}
              </ul>
            )
          ) : recruits.length === 0 ? (
            <p className={styles.empty}>
              {tab === 'all' ? '필터를 줄여 보세요' : '작성한 모집글이 없어요.'}
            </p>
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
        onSelect={handleSelect}
      />
    </div>
  );
}

function ApplicationRow({ application }: { application: MyApplication }) {
  const cancel = useCancelApplication();
  const card = toRecruitCardData(application.recruit);
  const status = APPLICATION_COPY[application.status];

  return (
    <li className={styles.application}>
      <RecruitCard recruit={card} />
      <div className={styles.applicationActions}>
        <p className={styles.applicationStatus}>
          {application.roleName} · {status}
        </p>
        {application.status === 'PENDING' && (
          <Button
            variant="outline"
            aria-disabled={cancel.isPending}
            onClick={() => {
              if (!cancel.isPending) cancel.mutate(application.id);
            }}
          >
            지원 취소
          </Button>
        )}
        {application.status === 'ACCEPTED' && application.teamChatRoomId != null && (
          <Button asChild>
            <Link href={`/chats/${application.teamChatRoomId}` as Route}>팀 채팅 바로가기</Link>
          </Button>
        )}
      </div>
    </li>
  );
}
