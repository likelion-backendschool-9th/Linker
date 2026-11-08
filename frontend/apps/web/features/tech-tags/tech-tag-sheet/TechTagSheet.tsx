'use client';

// Overlay: pick tech stack tags up to a limit (blueprint §3-1 `TechTagSheet`: 02, 05, 20, 22)
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';

import { techTagsOptions } from '../tech-tag-queries';
import styles from './TechTagSheet.module.css';

type TechTagSheetProps = {
  /** Selected tag names */
  value: string[];
  /** From `policy.ts` (e.g. `RECRUIT.techTagsMax`) */
  max: number;
  onSave: (names: string[]) => void;
  /** 'outline' (default, 02/05/22): outline pill + check icon. 'filled' (20, Figma 301:1914):
   *  solid selection color, no icon — Figma differs per screen for this shared sheet. */
  variant?: 'outline' | 'filled';
};

/** Open with `useOverlay('tech-tags').open()`; choices apply on "완료", other ways out keep the old value */
export function TechTagSheet({ value, max, onSave, variant = 'outline' }: TechTagSheetProps) {
  const overlay = useOverlay('tech-tags');
  return (
    <OverlaySheet
      overlay={overlay}
      title="기술 스택"
      description={`최대 ${max}개까지 고를 수 있어요.`}
    >
      {/* Mounted on open, so the draft starts from `value` each time */}
      {overlay.isOpen && (
        <TagChoices value={value} max={max} onSave={onSave} overlay={overlay} variant={variant} />
      )}
    </OverlaySheet>
  );
}

function TagChoices({
  value,
  max,
  onSave,
  overlay,
  variant,
}: TechTagSheetProps & { overlay: OverlayControl; variant: 'outline' | 'filled' }) {
  const tags = useQuery(techTagsOptions());
  const [selected, setSelected] = useState(value);
  const full = selected.length >= max;

  if (tags.isPending) return <Skeleton count={2} />;
  if (tags.isError) {
    return <ErrorState title="기술 스택을 불러오지 못했어요" onRetry={() => void tags.refetch()} />;
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(selected);
        overlay.close();
      }}
    >
      <fieldset className={styles.group}>
        <legend className="sr-only">기술 스택 목록</legend>
        <p className={full ? styles.full : styles.count} aria-live="polite">
          {selected.length}/{max}개 선택
          {full && ' · 더 고르려면 하나를 빼 주세요'}
        </p>
        <div className={styles.chips}>
          {tags.data.map((tag) => {
            const checked = selected.includes(tag.name);
            const chipClass = variant === 'filled' ? styles.chipFilled : styles.chip;
            return (
              <label key={tag.id} className={chipClass}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={checked}
                  disabled={!checked && full}
                  onChange={() =>
                    setSelected((current) =>
                      checked
                        ? current.filter((name) => name !== tag.name)
                        : [...current, tag.name],
                    )
                  }
                />
                {variant === 'outline' && checked && <Check aria-hidden className={styles.check} />}
                {tag.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className={styles.actions}>
        <Button variant="outline" onClick={() => setSelected([])}>
          모두 빼기
        </Button>
        <Button type="submit">완료</Button>
      </div>
    </form>
  );
}
