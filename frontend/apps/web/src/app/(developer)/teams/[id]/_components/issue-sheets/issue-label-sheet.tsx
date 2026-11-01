'use client';

// Overlay: labels (07 TODO 12), reused by 13
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useOverlay } from '@/lib/navigation/use-overlay';

import type { IssueLabel } from '../../_lib/issue-queries';
import { saveErrorMessage } from './save-error';
import styles from './issue-sheets.module.css';

type LabelOptions = { items: IssueLabel[] };

type IssueLabelSheetProps<Key extends readonly unknown[]> = {
  value: IssueLabel[];
  /** The repo's labels: 12's `label-options` */
  options: UseQueryOptions<LabelOptions, Error, LabelOptions, Key>;
  onSave: (labels: string[]) => Promise<unknown>;
};

export function IssueLabelSheet<Key extends readonly unknown[]>({
  value,
  options,
  onSave,
}: IssueLabelSheetProps<Key>) {
  const overlay = useOverlay('issue-labels');
  return (
    <OverlaySheet overlay={overlay} title="라벨" description="레포에 있는 라벨 중에서 골라요.">
      {overlay.isOpen && (
        <LabelForm value={value} options={options} onSave={onSave} onDone={overlay.close} />
      )}
    </OverlaySheet>
  );
}

function LabelForm<Key extends readonly unknown[]>({
  value,
  options,
  onSave,
  onDone,
}: IssueLabelSheetProps<Key> & { onDone: () => void }) {
  const query = useQuery(options);
  const [selected, setSelected] = useState<string[]>(() => value.map((label) => label.name));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (query.isError) {
    return (
      <ErrorState
        title="라벨을 불러오지 못했어요"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (query.isPending) {
    return (
      <div aria-busy="true">
        <p role="status">라벨을 불러오고 있어요.</p>
        <Skeleton variant="line" count={3} />
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        try {
          await onSave(selected);
          onDone();
        } catch (failure) {
          setError(saveErrorMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset className={styles.fieldset}>
        <legend className="sr-only">라벨 고르기</legend>
        {query.data.items.length === 0 ? (
          <p className={styles.note}>이 레포에 라벨이 없어요. GitHub에서 만들 수 있어요.</p>
        ) : (
          <div className={styles.options}>
            {query.data.items.map((label) => (
              <label key={label.name} className={styles.option}>
                <input
                  type="checkbox"
                  className={styles.control}
                  checked={selected.includes(label.name)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, label.name]
                        : current.filter((name) => name !== label.name),
                    )
                  }
                />
                {/* GitHub's label color is data, so it's inline; the name carries the meaning */}
                <span
                  className={styles.swatch}
                  style={{ backgroundColor: `#${label.color.replace(/^#/, '')}` }}
                  aria-hidden
                />
                <span className={styles.optionTitle}>{label.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" aria-disabled={pending}>
          {pending ? '저장하는 중…' : '저장'}
        </Button>
      </div>
    </form>
  );
}
