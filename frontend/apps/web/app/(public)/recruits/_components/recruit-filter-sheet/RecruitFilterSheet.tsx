'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import {
  RECRUIT_FORMAT_LABELS,
  RECRUIT_FORMATS,
  RECRUIT_ROLE_LABELS,
  RECRUIT_ROLES,
} from '@/features/recruit/recruit-labels';
import { techTagsOptions } from '@/features/tech-tags/tech-tag-queries';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import { RECRUIT_SORT_LABELS, RECRUIT_SORTS } from '../../_lib/list-queries';
import styles from './RecruitFilterSheet.module.css';

export type FilterField = 'role' | 'tech' | 'format' | 'sort';
/** Sheet selection stores API values (role/mode/sort enums, tech tag string). */
export type FilterState = Record<FilterField, string | null>;

export const DEFAULT_FILTER_STATE: FilterState = {
  role: null,
  tech: null,
  format: null,
  sort: 'NEWEST',
};

/** Area B chip label when nothing is picked yet. */
export const FILTER_CHIP_LABEL: Record<FilterField, string> = {
  role: '역할',
  tech: '기술 스택',
  format: '진행 방식',
  sort: '최신순',
};

type Option = { value: string; label: string };

/** `tech` options come from the tech tag API (the server filters by exact tag name). */
const FIELD_CONFIG: Record<FilterField, { sheetTitle: string; options: Option[] }> = {
  role: {
    sheetTitle: '역할',
    options: RECRUIT_ROLES.map((value) => ({ value, label: RECRUIT_ROLE_LABELS[value] })),
  },
  tech: { sheetTitle: '기술 스택', options: [] },
  format: {
    sheetTitle: '진행 방식',
    options: RECRUIT_FORMATS.map((value) => ({ value, label: RECRUIT_FORMAT_LABELS[value] })),
  },
  sort: {
    sheetTitle: '게시물 정렬',
    options: RECRUIT_SORTS.map((value) => ({ value, label: RECRUIT_SORT_LABELS[value] })),
  },
};

/**
 * 19 recruit list area B / counter-row single-select sheet (scenario 5, Figma 352:958). One sheet,
 * reused for all 4 triggers via `overlay.id` (role/tech/format/sort) as the field discriminator.
 * Picking only marks the option; "완료" closes the sheet first and then applies it, so the list
 * doesn't change behind the sheet and closing (history back) can't undo the new filter. ×, the
 * scrim or back drop the pick.
 */
export function RecruitFilterSheet({
  overlay,
  selected,
  onApply,
}: {
  overlay: OverlayControl;
  selected: FilterState;
  onApply: (field: FilterField, value: string | null) => void;
}) {
  const field = (overlay.id as FilterField | null) ?? 'sort';
  return (
    // A fresh pick each time the sheet opens, starting from what the list shows now
    <SheetBody
      key={`${field}-${overlay.isOpen}`}
      overlay={overlay}
      field={field}
      current={selected[field]}
      onApply={onApply}
    />
  );
}

function SheetBody({
  overlay,
  field,
  current,
  onApply,
}: {
  overlay: OverlayControl;
  field: FilterField;
  current: string | null;
  onApply: (field: FilterField, value: string | null) => void;
}) {
  const config = FIELD_CONFIG[field];
  const [draft, setDraft] = useState(current);
  const techTags = useQuery({ ...techTagsOptions(), enabled: overlay.isOpen && field === 'tech' });
  const options =
    field === 'tech'
      ? (techTags.data ?? []).map((tag) => ({ value: tag.name, label: tag.name }))
      : config.options;

  return (
    <OverlaySheet
      overlay={overlay}
      title={config.sheetTitle}
      description={`${config.sheetTitle} 선택`}
      describeHidden
      classNames={{ sheet: styles.sheet, title: styles.title }}
    >
      {field === 'tech' && techTags.isPending ? (
        <p className={styles.status}>불러오는 중…</p>
      ) : field === 'tech' && techTags.isError ? (
        <p className={styles.status}>기술 스택을 불러오지 못했어요.</p>
      ) : null}
      {field === 'tech' ? (
        // Figma 301:1914: gray chips, the picked one blue; one pick, tapping it again clears it
        <div className={styles.chips} role="radiogroup" aria-label={config.sheetTitle}>
          {options.map((option) => {
            const isSelected = draft === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={styles.chip}
                data-selected={isSelected}
                onClick={() => setDraft(isSelected ? null : option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : (
        <ul className={styles.list} role="radiogroup" aria-label={config.sheetTitle}>
          {options.map((option) => {
            const isSelected = draft === option.value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={styles.option}
                  data-selected={isSelected}
                  // Sort always has one; role/tech/format clear when the picked one is tapped again
                  onClick={() =>
                    setDraft(field !== 'sort' && draft === option.value ? null : option.value)
                  }
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        className={styles.cta}
        onClick={() =>
          void overlay.closeAnd(() => {
            if (draft !== current) onApply(field, draft);
          })
        }
      >
        완료
      </button>
    </OverlaySheet>
  );
}
