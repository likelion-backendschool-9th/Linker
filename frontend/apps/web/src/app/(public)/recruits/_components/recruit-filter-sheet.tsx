'use client';

// Overlay: role / tech stack / format filters of 19 (07 TODO 19), kept in the URL
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useId, useState, type ReactNode } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import {
  RECRUIT_FORMAT_LABELS,
  RECRUIT_FORMATS,
  RECRUIT_ROLE_LABELS,
  RECRUIT_ROLES,
} from '@/features/recruit/recruit-labels';
import { techTagsOptions } from '@/features/tech-tags/tech-tag-queries';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';

import { recruitFilterParsers, type RecruitFilters } from '../_lib/recruit-filters';
import styles from './recruit-filter-sheet.module.css';

type Draft = Pick<RecruitFilters, 'role' | 'tech' | 'mode'>;

const CLEARED: Draft = { role: null, tech: null, mode: null };

/**
 * Choices are a draft until "결과 보기": the sheet closes with `history.back()`, which would undo
 * URL changes made while it was open, so the filters are written after it has closed (`closeAnd`).
 */
export function RecruitFilterSheet() {
  const overlay = useOverlay('recruit-filter');
  return (
    <OverlaySheet
      overlay={overlay}
      title="필터"
      description="조건을 고르고 결과 보기를 누르면 목록에 적용돼요."
    >
      {/* Mounted on open, so the draft starts from the URL each time */}
      {overlay.isOpen && <FilterFields overlay={overlay} />}
    </OverlaySheet>
  );
}

function FilterFields({ overlay }: { overlay: OverlayControl }) {
  const [filters, setFilters] = useQueryStates(recruitFilterParsers, { history: 'replace' });
  const [draft, setDraft] = useState<Draft>({
    role: filters.role,
    tech: filters.tech,
    mode: filters.mode,
  });
  const tags = useQuery(techTagsOptions());
  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <form
      className={styles.fields}
      onSubmit={(event) => {
        event.preventDefault();
        void overlay.closeAnd(() => setFilters(draft));
      }}
    >
      <ChipGroup legend="역할">
        <Chip name="role" checked={!draft.role} onChange={() => change({ role: null })}>
          전체
        </Chip>
        {RECRUIT_ROLES.map((role) => (
          <Chip
            key={role}
            name="role"
            checked={draft.role === role}
            onChange={() => change({ role })}
          >
            {RECRUIT_ROLE_LABELS[role]}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup legend="진행 방식">
        <Chip name="mode" checked={!draft.mode} onChange={() => change({ mode: null })}>
          전체
        </Chip>
        {RECRUIT_FORMATS.map((mode) => (
          <Chip
            key={mode}
            name="mode"
            checked={draft.mode === mode}
            onChange={() => change({ mode })}
          >
            {RECRUIT_FORMAT_LABELS[mode]}
          </Chip>
        ))}
      </ChipGroup>

      {tags.isError ? (
        <ErrorState
          title="기술 스택을 불러오지 못했어요"
          onRetry={() => {
            void tags.refetch();
          }}
        />
      ) : (
        <ChipGroup legend="기술 스택" busy={tags.isPending}>
          <Chip name="tech" checked={!draft.tech} onChange={() => change({ tech: null })}>
            전체
          </Chip>
          {tags.data?.map((tag) => (
            <Chip
              key={tag.id}
              name="tech"
              checked={draft.tech === tag.name}
              onChange={() => change({ tech: tag.name })}
            >
              {tag.name}
            </Chip>
          ))}
        </ChipGroup>
      )}

      <div className={styles.actions}>
        <Button variant="outline" onClick={() => setDraft(CLEARED)}>
          필터 초기화
        </Button>
        <Button type="submit">결과 보기</Button>
      </div>
    </form>
  );
}

function ChipGroup({
  legend,
  busy = false,
  children,
}: {
  legend: string;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className={styles.group} aria-busy={busy}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.chips}>{children}</div>
    </fieldset>
  );
}

type ChipProps = {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
};

/** A radio styled as a pill; selected also shows a check, not color alone */
function Chip({ name, checked, onChange, children }: ChipProps) {
  const id = useId();
  return (
    <label htmlFor={id} className={styles.chip}>
      <input
        id={id}
        type="radio"
        name={name}
        className={styles.radio}
        checked={checked}
        onChange={onChange}
      />
      {checked && <Check aria-hidden className={styles.check} />}
      {children}
    </label>
  );
}
