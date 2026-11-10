'use client';

import { useQuery } from '@tanstack/react-query';

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
 */
export function RecruitFilterSheet({
  overlay,
  selected,
  onSelect,
}: {
  overlay: OverlayControl;
  selected: FilterState;
  onSelect: (field: FilterField, value: string) => void;
}) {
  const field = (overlay.id as FilterField | null) ?? 'sort';
  const config = FIELD_CONFIG[field];
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
      classNames={{ title: styles.title }}
    >
      {field === 'tech' && techTags.isPending ? (
        <p className={styles.status}>불러오는 중…</p>
      ) : field === 'tech' && techTags.isError ? (
        <p className={styles.status}>기술 스택을 불러오지 못했어요.</p>
      ) : null}
      <ul className={styles.list} role="radiogroup" aria-label={config.sheetTitle}>
        {options.map((option) => {
          const isSelected = selected[field] === option.value;
          return (
            <li key={option.value}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={styles.option}
                data-selected={isSelected}
                onClick={() => onSelect(field, option.value)}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className={styles.cta} onClick={() => overlay.close()}>
        완료
      </button>
    </OverlaySheet>
  );
}
