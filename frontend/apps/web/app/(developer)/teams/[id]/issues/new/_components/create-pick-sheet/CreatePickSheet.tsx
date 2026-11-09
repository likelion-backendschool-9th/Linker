'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';

import styles from '../../../../_components/issue-sheets/issue-sheets.module.css';
import { sheetClassNames } from '../../../../_components/issue-sheets/sheet-class-names';
import { useCreatePickForm, useCreatePickSheet, type CreatePickSheetProps } from './hook';

/** Figma 708:1814 / 708:1965 — radio list + 「변경」 for repo / template. */
export function CreatePickSheet(props: CreatePickSheetProps) {
  const { overlay, title, value, options, empty, onChange } = useCreatePickSheet(props);

  return (
    <OverlaySheet
      overlay={overlay}
      title={title}
      description={title}
      describeHidden
      classNames={sheetClassNames}
    >
      {overlay.isOpen && (
        <PickForm
          key={value ?? 'empty'}
          title={title}
          value={value}
          options={options}
          empty={empty}
          onChange={onChange}
          closeAnd={overlay.closeAnd}
        />
      )}
    </OverlaySheet>
  );
}

function PickForm({
  title,
  value,
  options,
  empty,
  onChange,
  closeAnd,
}: {
  title: string;
  value: string | null;
  options: CreatePickSheetProps['options'];
  empty: string;
  onChange: (value: string) => void;
  closeAnd: (action: () => unknown) => Promise<void>;
}) {
  const { draft, setDraft, confirm, pending } = useCreatePickForm(value, onChange, closeAnd);

  return (
    <form className={styles.form} onSubmit={confirm}>
      {options.length === 0 ? (
        <p className={styles.note}>{empty}</p>
      ) : (
        <fieldset className={styles.fieldset}>
          <legend className="sr-only">{title}</legend>
          <div className={styles.rows}>
            {options.map((option) => (
              <label key={option.value} className={`${styles.option} ${styles.optionPick}`}>
                <input
                  type="radio"
                  name={title}
                  className={styles.control}
                  checked={draft === option.value}
                  onChange={() => setDraft(option.value)}
                />
                <span className={styles.radioMark} aria-hidden />
                <span className={styles.statusName}>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <button type="submit" className={styles.save} aria-disabled={pending || !draft}>
        변경
      </button>
    </form>
  );
}
