'use client';

import { AddBoldIcon } from '@solar-icons/static/bold/add';
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { useState } from 'react';

import { Icon } from '@/components/ui/icon';

import { useOverlay } from '@/lib/navigation/use-overlay';

import { RecruitCard, type RecruitCardData } from '../recruit-card';
import {
  DEFAULT_FILTER_STATE,
  RecruitFilterSheet,
  type FilterField,
  type FilterState,
} from '../recruit-filter-sheet';
import { RecruitSearchPanel } from '../recruit-search-panel';
import { RecruitTabs } from '../recruit-tabs';
import { TabChromeCollapseEffect } from '../../../_components/tab-chrome-collapse';
import styles from './RecruitList.module.css';

const SAMPLE_RECRUITS: RecruitCardData[] = [
  {
    id: '1',
    format: '온라인',
    goal: '공모전',
    deadlineLabel: '2026.11.16 마감',
    deadlineFullLabel: '2026년 11월 16일 마감',
    title: '공연을 저장하고 스케줄링 하는 공연 정보 플랫폼',
    description: '연극·뮤지컬·무용·국악·콘서트 등의 공연 정보는 공연장, 예매처, 를 한번에 해결하는 서비스',
    roles: ['PM 1명', 'Frontend 1명', 'Backend 4명', 'Designer 1명'],
    recruitingRoleLabel: '백엔드 1명',
    techStack: ['Java', 'Spring', 'JavaScript', 'Next.js', 'Jpa', 'Aws', 'TypeScript', 'Node.js'],
  },
  {
    id: '2',
    format: '하이브리드',
    goal: '해커톤',
    deadlineLabel: '2026.11.11 마감',
    deadlineFullLabel: '2026년 11월 11일 마감',
    title: '개발자를 위한 포트폴리오 SNS 솔루션',
    description:
      '워크스페이스와 SNS를 합친 개발자들의 네트워크 서비스 입니다. 기획을 다듬어주실 PM, 풀스택 개발자 1분 기다리겠습니다.',
    roles: ['PM 1명', '풀 스택 1명'],
    recruitingRoleLabel: '풀 스택 1명',
    techStack: ['React', 'Next.js', 'TypeScript', 'Node.js'],
  },
  {
    id: '3',
    format: '오프라인',
    goal: '출시',
    deadlineLabel: '2026.11.9 마감',
    deadlineFullLabel: '2026년 11월 9일 마감',
    title: '개발자를 위한 포트폴리오 SNS 솔루션',
    description:
      '워크스페이스와 SNS를 합친 개발자들의 네트워크 서비스 입니다. 기획을 다듬어주실 PM, 풀스택 개발자 1분 기다리겠습니다.',
    roles: ['PM 1명', '풀 스택 1명'],
    recruitingRoleLabel: '풀 스택 1명',
    techStack: ['React', 'Next.js', 'TypeScript', 'Node.js'],
  },
];

/** 19 recruit list (Figma 254:2124). Filter/sort sheets are scenario 5 (Figma 352:958). */
export function RecruitList() {
  const filterOverlay = useOverlay('recruit-filter');
  const [selectedFilters, setSelectedFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);

  function handleSelect(field: FilterField, value: string) {
    setSelectedFilters((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className={styles.page}>
      <TabChromeCollapseEffect />
      {/* Slot keeps in-flow height while the chrome pins to the viewport top when collapsed */}
      <div className={styles.chromeSlot}>
        <div className={styles.chromeSticky} data-tab-chrome>
          <RecruitTabs />
          <RecruitSearchPanel filterOverlay={filterOverlay} selectedFilters={selectedFilters} />
        </div>
      </div>
      <div className={styles.toolbar}>
        <p className={styles.count}>
          총 <span className={styles.countNumber}>{SAMPLE_RECRUITS.length}개</span>의 모집글
        </p>
        <button
          type="button"
          className={styles.sort}
          aria-haspopup="dialog"
          aria-expanded={filterOverlay.isOpen && filterOverlay.id === 'sort'}
          onClick={() => filterOverlay.open('sort')}
        >
          {selectedFilters.sort}
          <Icon svg={AltArrowDownLinearIcon} className={styles.sortIcon} />
        </button>
      </div>
      <ul className={styles.list}>
        {SAMPLE_RECRUITS.map((recruit) => (
          <RecruitCard key={recruit.id} recruit={recruit} />
        ))}
      </ul>
      <div className={styles.fabLayer}>
        <button type="button" className={styles.fab}>
          <span className={styles.fabVisual}>
            <Icon svg={AddBoldIcon} className={styles.fabIcon} />
          </span>
          <span className="sr-only">모집글 쓰기</span>
        </button>
      </div>
      <RecruitFilterSheet overlay={filterOverlay} selected={selectedFilters} onSelect={handleSelect} />
    </div>
  );
}
