'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import { getVisibleTechTags, type TechTagOption } from './options';
import styles from './TechTagPicker.module.css';

export type { TechTagOption } from './options';

export function TechTagPicker({
  overlay,
  tags,
  selected,
  max,
  onToggle,
  onDone,
  pending = false,
  error,
  message,
  loading = false,
  onRetry,
}: {
  overlay: OverlayControl;
  tags: TechTagOption[];
  selected: string[];
  max: number;
  onToggle: (name: string) => void;
  onDone?: () => void;
  pending?: boolean;
  error?: string | null;
  message?: string | null;
  loading?: boolean;
  onRetry?: () => void;
}) {
  const visibleTags = getVisibleTechTags(tags);

  return (
    <OverlaySheet
      overlay={overlay}
      title="기술 스택"
      description={`최대 ${max}개까지 선택할 수 있어요.`}
      describeHidden
      classNames={{
        scrim: styles.scrim,
        sheet: styles.sheet,
        header: styles.header,
        title: styles.title,
        close: styles.close,
        body: styles.body,
      }}
    >
      <div className={styles.content}>
        {loading ? (
          <Skeleton count={2} />
        ) : error ? (
          <ErrorState title={error} onRetry={onRetry} />
        ) : (
          <ul className={styles.list} aria-label="기술 스택 목록">
            {visibleTags.map((tag) => {
              const checked = selected.includes(tag.name);
              return (
                <li key={tag.id}>
                  <label className={styles.option}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={pending || (!checked && selected.length >= max)}
                      onChange={() => onToggle(tag.name)}
                    />
                    <span>{tag.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {message && (
          <p className={styles.inlineError} role="alert">
            {message}
          </p>
        )}
        <button
          type="button"
          className={styles.done}
          disabled={pending}
          onClick={() => (onDone ? onDone() : overlay.close())}
        >
          완료
        </button>
      </div>
    </OverlaySheet>
  );
}
