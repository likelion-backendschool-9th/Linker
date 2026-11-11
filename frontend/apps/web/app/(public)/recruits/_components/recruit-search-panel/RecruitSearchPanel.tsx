'use client';

import { CloseLinearIcon } from '@solar-icons/static/linear/close';
import { MagnifierLinearIcon } from '@solar-icons/static/linear/magnifier';
import { useId, useRef } from 'react';

import { Icon } from '@/components/ui/icon';

import type { OverlayControl } from '@/lib/navigation/use-overlay';

import { RECRUIT_SEARCH_MAX_LENGTH } from '../../_lib/list-queries';
import { FILTER_CHIP_LABEL, type FilterField, type FilterState } from '../recruit-filter-sheet';
import type { RecruitSearchControl } from '../recruit-list/hook';
import styles from './RecruitSearchPanel.module.css';

const FILTER_FIELDS: FilterField[] = ['role', 'tech', 'format', 'sort'];

/**
 * 19 recruit list area B (Figma 253:2122): revealed under the tabs once scroll leaves the top
 * (scenario 2), and kept open at the top too while a search or filter is in the URL (`pinned`), so
 * what narrows the list stays in view. The search field's 2px focus border is scenario 3 (Figma
 * 346:360); it searches post titles only (POL-R-2, `?q=`) and runs on Enter or the magnifier, not
 * while typing. Each chip opens RecruitFilterSheet (scenario 5, Figma 352:958) and then shows the
 * picked value in place of its name (역할 → 프론트엔드).
 */
export function RecruitSearchPanel({
  filterOverlay,
  search,
  selectedFilters,
  pinned,
  onReset,
}: {
  filterOverlay: OverlayControl;
  search: RecruitSearchControl;
  selectedFilters: FilterState;
  pinned: boolean;
  /** "초기화" (Figma 1088:321): search, filters and sort back to the defaults */
  onReset: () => void;
}) {
  const value = search.draft;
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  return (
    <div className={styles.panel} data-pinned={pinned || undefined}>
      <div className={styles.inner}>
        <form role="search" className={styles.searchField} onSubmit={search.submit}>
          <button type="submit" className={styles.searchButton}>
            <Icon svg={MagnifierLinearIcon} className={styles.searchIcon} />
            <span className="sr-only">검색</span>
          </button>
          <label htmlFor={inputId} className="sr-only">
            검색어를 입력해 주세요
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            placeholder="검색어를 입력해 주세요"
            className={styles.searchInput}
            maxLength={RECRUIT_SEARCH_MAX_LENGTH}
            enterKeyHint="search"
            value={value}
            onChange={(event) => search.setDraft(event.target.value)}
            // Blurred when the chrome reopens at the top, unless the panel stays open there anyway
            data-tab-chrome-blur={pinned ? undefined : true}
          />
          {value && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={() => {
                search.clear();
                inputRef.current?.focus();
              }}
            >
              <Icon svg={CloseLinearIcon} className={styles.clearIcon} />
              <span className="sr-only">검색어 지우기</span>
            </button>
          )}
        </form>
        <div className={styles.chips}>
          {FILTER_FIELDS.map((field) => (
            <button
              key={field}
              type="button"
              className={styles.chip}
              aria-haspopup="dialog"
              aria-expanded={filterOverlay.isOpen && filterOverlay.id === field}
              onClick={() => filterOverlay.open(field)}
            >
              {selectedFilters[field] ?? FILTER_CHIP_LABEL[field]}
            </button>
          ))}
          <button type="button" className={styles.chip} onClick={onReset}>
            초기화
          </button>
        </div>
      </div>
    </div>
  );
}
