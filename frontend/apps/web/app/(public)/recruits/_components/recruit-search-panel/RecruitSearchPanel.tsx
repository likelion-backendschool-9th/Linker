'use client';

import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
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
 * (scenario 2). Visibility/height is driven by `.tab-chrome-collapsed`, see RecruitList.module.css.
 * The search field's 2px focus border is scenario 3 (Figma 346:360); it searches post titles only
 * (POL-R-2, `?q=`). The filter chips each open RecruitFilterSheet (scenario 5, Figma 352:958).
 */
export function RecruitSearchPanel({
  filterOverlay,
  search,
  selectedFilters,
}: {
  filterOverlay: OverlayControl;
  search: RecruitSearchControl;
  selectedFilters: FilterState;
}) {
  const value = search.draft;
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  return (
    <div className={styles.panel}>
      <div className={styles.inner}>
        <form role="search" className={styles.searchField} onSubmit={search.submit}>
          <Icon svg={MagnifierLinearIcon} className={styles.searchIcon} />
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
            data-tab-chrome-blur
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
              <Icon svg={AltArrowDownLinearIcon} className={styles.chipIcon} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
