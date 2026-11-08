'use client';

// "마감일" bottom sheet (Figma 364:1308, wheel 368:3920): 연도/월/일 scroll wheels, "저장" to commit
import { useEffect, useRef, useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from './DeadlineSheet.module.css';

type DeadlineSheetProps = {
  overlay: OverlayControl;
  /** Current `yyyy-MM-dd`, or '' if not set yet */
  value: string;
  /** `yyyy-MM-dd`, inclusive bounds (today and today + policy window) */
  min: string;
  max: string;
  onSave: (date: string) => void;
};

type DayEntry = { y: number; m: number; d: number; iso: string };

function enumerateDays(min: string, max: string): DayEntry[] {
  const out: DayEntry[] = [];
  let cursor = new Date(`${min}T00:00:00`);
  const end = new Date(`${max}T00:00:00`);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const d = cursor.getDate();
    out.push({ y, m, d, iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    cursor = new Date(y, m - 1, d + 1);
  }
  return out;
}

function unique(values: number[]): number[] {
  return [...new Set(values)];
}

export function DeadlineSheet({ overlay, value, min, max, onSave }: DeadlineSheetProps) {
  return (
    <OverlaySheet overlay={overlay} title="마감일" description="마감일을 골라 주세요." describeHidden>
      {overlay.isOpen && <DeadlineWheels value={value} min={min} max={max} onSave={onSave} overlay={overlay} />}
    </OverlaySheet>
  );
}

function DeadlineWheels({
  value,
  min,
  max,
  onSave,
  overlay,
}: Omit<DeadlineSheetProps, 'overlay'> & { overlay: OverlayControl }) {
  const [days] = useState(() => enumerateDays(min, max));
  const initial = days.find((entry) => entry.iso === value) ?? days[0]!;
  const [year, setYear] = useState(initial.y);
  const [month, setMonth] = useState(initial.m);
  const [day, setDay] = useState(initial.d);

  const years = unique(days.map((entry) => entry.y));
  const months = unique(days.filter((entry) => entry.y === year).map((entry) => entry.m));
  const validMonth = months.includes(month) ? month : months[0]!;
  const dayEntries = days.filter((entry) => entry.y === year && entry.m === validMonth);
  const validDay = dayEntries.some((entry) => entry.d === day) ? day : dayEntries[0]!.d;

  return (
    <div>
      <div className={styles.wheels}>
        <div className={styles.highlight} aria-hidden />
        <WheelColumn
          values={years}
          selected={year}
          format={(v) => `${v}`}
          label="연도"
          onSelect={setYear}
        />
        <WheelColumn
          values={months}
          selected={validMonth}
          format={(v) => `${v}`}
          label="월"
          onSelect={setMonth}
        />
        <WheelColumn
          values={dayEntries.map((entry) => entry.d)}
          selected={validDay}
          format={(v) => `${v}`}
          label="일"
          onSelect={setDay}
        />
      </div>
      <button
        type="button"
        className={styles.save}
        onClick={() => {
          const iso = `${year}-${String(validMonth).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
          onSave(iso);
          overlay.close();
        }}
      >
        저장
      </button>
    </div>
  );
}

function WheelColumn({
  values,
  selected,
  format,
  label,
  onSelect,
}: {
  values: number[];
  selected: number;
  format: (value: number) => string;
  label: string;
  onSelect: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const index = Math.max(0, values.indexOf(selected));

  // scrollTo isn't implemented in some test/embedded WebView environments; skip there rather
  // than throw (the column still renders, just without the initial scroll position)
  function scrollToIndex(target: number, behavior: ScrollBehavior) {
    const el = ref.current;
    if (!el || typeof el.scrollTo !== 'function') return;
    el.scrollTo({ top: target * ROW_HEIGHT, behavior });
  }

  // Re-center on mount and whenever the available values change under this column (e.g. a new
  // year changes which months are in range) or the selection moves from outside this column
  useEffect(() => {
    scrollToIndex(index, 'instant');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.join(','), selected]);

  function handleScroll() {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const nextIndex = Math.round(el.scrollTop / ROW_HEIGHT);
      const next = values[Math.min(Math.max(nextIndex, 0), values.length - 1)];
      if (next !== undefined && next !== selected) onSelect(next);
    }, 120);
  }

  return (
    <div
      ref={ref}
      className={styles.column}
      role="listbox"
      aria-label={label}
      onScroll={handleScroll}
    >
      <div className={styles.spacer} aria-hidden />
      {values.map((value) => (
        <button
          key={value}
          type="button"
          role="option"
          aria-selected={value === selected}
          className={value === selected ? styles.itemSelected : styles.item}
          onClick={() => {
            onSelect(value);
            scrollToIndex(values.indexOf(value), 'smooth');
          }}
        >
          {format(value)}
        </button>
      ))}
      <div className={styles.spacer} aria-hidden />
    </div>
  );
}

const ROW_HEIGHT = 39;
