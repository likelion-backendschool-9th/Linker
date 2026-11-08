'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from './RecruitFilterSheet.module.css';

export type FilterField = 'role' | 'tech' | 'format' | 'sort';
export type FilterState = Record<FilterField, string | null>;

export const DEFAULT_FILTER_STATE: FilterState = {
  role: null,
  tech: null,
  format: '온라인',
  sort: '최신순',
};

/** Area B's generic chip label when nothing is picked yet; 온라인/최신순 default to a value instead. */
export const FILTER_CHIP_LABEL: Record<FilterField, string> = {
  role: '역할',
  tech: '기술 스택',
  format: '온라인',
  sort: '최신순',
};

const FIELD_CONFIG: Record<FilterField, { sheetTitle: string; options: string[] }> = {
  role: { sheetTitle: '역할', options: ['PM', 'Frontend', 'Backend', 'Designer', '풀 스택'] },
  tech: {
    sheetTitle: '기술 스택',
    options: ['React', 'Next.js', 'TypeScript', 'JavaScript', 'Node.js', 'Java', 'Spring', 'Python'],
  },
  format: { sheetTitle: '진행 방식', options: ['온라인', '오프라인', '하이브리드'] },
  sort: { sheetTitle: '게시물 정렬', options: ['최신순', '오래 된 순', '마감순'] },
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

  return (
    <OverlaySheet
      overlay={overlay}
      title={config.sheetTitle}
      description={`${config.sheetTitle} 선택`}
      describeHidden
      classNames={{ title: styles.title }}
    >
      <ul className={styles.list} role="radiogroup" aria-label={config.sheetTitle}>
        {config.options.map((option) => {
          const isSelected = selected[field] === option;
          return (
            <li key={option}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={styles.option}
                data-selected={isSelected}
                onClick={() => onSelect(field, option)}
              >
                {option}
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
