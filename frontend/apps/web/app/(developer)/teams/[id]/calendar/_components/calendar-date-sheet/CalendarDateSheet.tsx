'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from './CalendarDateSheet.module.css';

const YEARS_AROUND = 5;
const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  unit: '월',
}));

type CalendarDateSheetProps = {
  overlay: OverlayControl;
  /** The month on screen, `yyyy-MM-dd` */
  anchor: string;
  onSave: (year: number, month: number) => unknown;
};

/** "날짜 선택" sheet of Figma 368:3024: year and month wheels, then "저장" */
export function CalendarDateSheet({ overlay, anchor, onSave }: CalendarDateSheetProps) {
  return (
    <OverlaySheet
      overlay={overlay}
      title="날짜 선택"
      description="연도와 월을 고르고 저장을 누르면 그 달로 이동해요."
      describeHidden
      classNames={{ scrim: styles.scrim, sheet: styles.sheet, title: styles.title }}
    >
      {/* Mounted on open, so the wheels start from the month on screen each time */}
      {overlay.isOpen && <Wheels overlay={overlay} anchor={anchor} onSave={onSave} />}
    </OverlaySheet>
  );
}

function Wheels({ overlay, anchor, onSave }: CalendarDateSheetProps) {
  const [year, setYear] = useState(Number(anchor.slice(0, 4)));
  const [month, setMonth] = useState(Number(anchor.slice(5, 7)));
  const years = Array.from({ length: YEARS_AROUND * 2 + 1 }, (_, index) => {
    const value = Number(anchor.slice(0, 4)) - YEARS_AROUND + index;
    return { value, unit: '년' };
  });

  return (
    <>
      <div className={styles.wheels}>
        <div className={styles.band} aria-hidden />
        <Wheel label="연도" options={years} value={year} onChange={setYear} />
        <span className={styles.line} aria-hidden />
        <Wheel label="월" options={MONTHS} value={month} onChange={setMonth} />
      </div>
      <button
        type="button"
        className={styles.save}
        onClick={() => void overlay.closeAnd(() => onSave(year, month))}
      >
        저장
      </button>
    </>
  );
}

type Option = { value: number; unit: string };

/** Scroll-snap wheel: three rows, the middle one is the choice. Arrow keys and taps work too. */
function Wheel({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: number;
  onChange: (value: number) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const rowHeight = () => listRef.current?.querySelector('li')?.offsetHeight || 1;

  // Bring the chosen row to the middle (first paint, taps, arrow keys)
  useEffect(() => {
    const list = listRef.current;
    if (list && Math.round(list.scrollTop / rowHeight()) !== index)
      list.scrollTop = index * rowHeight();
  }, [index]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function onScroll() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = Math.round((listRef.current?.scrollTop ?? 0) / rowHeight());
      const option = options[Math.min(options.length - 1, Math.max(0, next))];
      if (option) onChange(option.value);
    }, 100);
  }

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = options[Math.min(options.length - 1, Math.max(0, index + step))];
    if (next) onChange(next.value);
  }

  return (
    <ul
      ref={listRef}
      className={styles.wheel}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`wheel-${label}-${value}`}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => (
        <li key={option.value} role="none" className={styles.row}>
          <button
            id={`wheel-${label}-${option.value}`}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={option.value === value}
            className={styles.option}
            onClick={() => onChange(option.value)}
          >
            {option.value}
            <span className="sr-only">{option.unit}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
