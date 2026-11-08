'use client';

// Own region: 22 start/end period sheet (Figma 368:3896) — year / month / day wheels
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';

import styles from './PostPeriodSheet.module.css';

const YEARS_AROUND = 30;
const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  unit: '월',
}));

export type PeriodField = 'start' | 'end';

type PostPeriodSheetProps = {
  /** Current form values (`yyyy-MM`); empty string = unset */
  start: string;
  end: string;
  onSave: (field: PeriodField, value: string) => void;
};

function parseMonth(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return { year, month };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function formatMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** "시작일" / "마감일" sheet: three-column wheel, then "저장" (Figma 364:1449) */
export function PostPeriodSheet({ start, end, onSave }: PostPeriodSheetProps) {
  const overlay = useOverlay('post-period');
  const field: PeriodField | null =
    overlay.id === 'start' || overlay.id === 'end' ? overlay.id : null;
  const title = field === 'end' ? '마감일' : '시작일';
  const current = field === 'end' ? end : start;

  return (
    <OverlaySheet
      overlay={overlay}
      title={title}
      description={`${title}을 고르고 저장을 누르면 반영돼요.`}
      describeHidden
      classNames={{ scrim: styles.scrim, sheet: styles.sheet, title: styles.title }}
    >
      {overlay.isOpen && field && (
        <Wheels
          key={field}
          overlay={overlay}
          current={current}
          onSave={(value) => onSave(field, value)}
        />
      )}
    </OverlaySheet>
  );
}

function Wheels({
  overlay,
  current,
  onSave,
}: {
  overlay: OverlayControl;
  current: string;
  onSave: (value: string) => void;
}) {
  const parsed = parseMonth(current);
  const fallback = new Date();
  const initialYear = parsed?.year ?? fallback.getFullYear();
  const initialMonth = parsed?.month ?? fallback.getMonth() + 1;
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [day, setDay] = useState(() =>
    Math.min(fallback.getDate(), daysInMonth(initialYear, initialMonth)),
  );
  const [years] = useState(() =>
    Array.from({ length: YEARS_AROUND * 2 + 1 }, (_, index) => ({
      value: initialYear - YEARS_AROUND + index,
      unit: '년',
    })),
  );

  const dayCount = daysInMonth(year, month);
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, index) => ({ value: index + 1, unit: '일' })),
    [dayCount],
  );
  // Clamp during render when the month shrinks (e.g. 31 → Feb) instead of syncing state in an effect
  const selectedDay = Math.min(day, dayCount);

  return (
    <>
      <div className={styles.wheels}>
        <div className={styles.band} aria-hidden />
        <span className={`${styles.line} ${styles.lineStart}`} aria-hidden />
        <span className={`${styles.line} ${styles.lineEnd}`} aria-hidden />
        <Wheel
          label="연도"
          options={years}
          value={year}
          onChange={setYear}
          format={(value) => String(value).slice(-2)}
        />
        <Wheel label="월" options={MONTHS} value={month} onChange={setMonth} />
        <Wheel label="일" options={days} value={selectedDay} onChange={setDay} />
      </div>
      <button
        type="button"
        className={styles.save}
        onClick={() => {
          // Policy / ERD: period is month precision; day is Figma wheel only
          onSave(formatMonth(year, month));
          overlay.close();
        }}
      >
        저장
      </button>
    </>
  );
}

type Option = { value: number; unit: string };

/** Must match `--wheel-row-height` so snap math and layout stay in sync. */
const ROW_HEIGHT = 37;

/** Scroll-snap wheel: three rows, the middle one is the choice (same pattern as 15). */
function Wheel({
  label,
  options,
  value,
  onChange,
  format = String,
}: {
  label: string;
  options: Option[];
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Skip programmatic scrollTop when the index change came from the user scrolling. */
  const scrolledByUser = useRef(false);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (scrolledByUser.current) {
      scrolledByUser.current = false;
      return;
    }
    const top = index * ROW_HEIGHT;
    if (Math.round(list.scrollTop) !== top) list.scrollTop = top;
  }, [index]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function commitScroll() {
    const list = listRef.current;
    if (!list) return;
    const next = Math.min(
      options.length - 1,
      Math.max(0, Math.round(list.scrollTop / ROW_HEIGHT)),
    );
    const option = options[next];
    if (!option) return;
    // Snap exactly onto the row so the next gesture starts from a clean offset
    list.scrollTop = next * ROW_HEIGHT;
    if (option.value !== value) {
      scrolledByUser.current = true;
      onChange(option.value);
    }
  }

  function onScroll() {
    clearTimeout(timer.current);
    timer.current = setTimeout(commitScroll, 80);
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
      aria-activedescendant={`post-wheel-${label}-${value}`}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => (
        <li key={option.value} role="none" className={styles.row}>
          <button
            id={`post-wheel-${label}-${option.value}`}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={option.value === value}
            className={styles.option}
            onClick={() => onChange(option.value)}
          >
            {format(option.value)}
            <span className="sr-only">{option.unit}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
