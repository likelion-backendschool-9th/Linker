'use client';

import { sheetClassNames } from '../sheet-class-names';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from '../issue-sheets.module.css';
import { useIssueLabelForm, useIssueLabelSheet, type IssueLabelSheetProps } from './hook';

export function IssueLabelSheet<Key extends readonly unknown[]>({
  value,
  options,
  onSave,
}: IssueLabelSheetProps<Key>) {
  const overlay = useIssueLabelSheet();
  return (
    <OverlaySheet
      overlay={overlay}
      title="이슈 라벨"
      description="이슈 라벨"
      describeHidden
      classNames={sheetClassNames}
    >
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
  const { query, selected, pending, error, toggle, submit } = useIssueLabelForm({
    value,
    options,
    onSave,
    onDone,
  });

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
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.fieldset}>
        <legend className="sr-only">라벨 고르기</legend>
        {query.data.items.length === 0 ? (
          <p className={styles.note}>이 레포에 라벨이 없어요. GitHub에서 만들 수 있어요.</p>
        ) : (
          <div className={styles.chips}>
            {query.data.items.map((label) => (
              <label key={label.name} className={styles.chip}>
                <input
                  type="checkbox"
                  className={styles.control}
                  checked={selected.includes(label.name)}
                  onChange={(event) => toggle(label.name, event.target.checked)}
                />
                <span>{label.name}</span>
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
      <button type="submit" className={styles.save} aria-disabled={pending}>
        {pending ? '저장하는 중…' : '완료'}
      </button>
    </form>
  );
}
