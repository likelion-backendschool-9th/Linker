'use client';

// Overlay: year / month / day wheel sheet shared by 20 (마감일) and 22 (시작일 · 마감일), Figma 368:3896
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { todayKst } from '@/lib/format/time';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from './DatePickerSheet.module.css';

/** Years shown either side of the start when there are no `min` / `max` bounds */
const YEARS_AROUND = 30;
/** Must match `--wheel-row-height` so the snap math and the layout stay in sync */
const ROW_HEIGHT = 37;
/** Quiet time that ends one wheel / trackpad gesture: each gesture moves exactly one row */
const WHEEL_GESTURE_MS = 140;
/** Quiet time after touch scrolling before the row under the band becomes the choice */
const SCROLL_SETTLE_MS = 80;

type DatePickerSheetProps = {
  overlay: OverlayControl;
  title: string;
  /** Screen-reader description (hidden on screen, like the Figma sheet) */
  description: string;
  /** `yyyy-MM-dd`, or '' to start from today (clamped into the bounds) */
  value: string;
  /** Inclusive `yyyy-MM-dd` bounds; without them the year wheel spans ±30 years */
  min?: string;
  max?: string;
  /** Year wheel label; 22 shows the last two digits (Figma 368:3896) */
  formatYear?: (year: number) => string;
  /** Gets the chosen `yyyy-MM-dd` on "저장", then the sheet closes */
  onSave: (date: string) => void;
};

type Ymd = { y: number; m: number; d: number };

function parseYmd(value: string | undefined): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

const toIso = ({ y, m, d }: Ymd) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

/** Nearest allowed value, so a choice that falls out of range lands on the closest edge */
function clampTo(values: number[], value: number) {
  if (values.includes(value)) return value;
  const first = values[0] ?? value;
  const last = values[values.length - 1] ?? value;
  return value < first ? first : last;
}

export function DatePickerSheet({ overlay, title, description, ...wheels }: DatePickerSheetProps) {
  return (
    <OverlaySheet
      overlay={overlay}
      title={title}
      description={description}
      describeHidden
      classNames={{ scrim: styles.scrim, sheet: styles.sheet, title: styles.title }}
    >
      {/* Mounted on open, so each opening starts from the current `value` */}
      {overlay.isOpen && <DateWheels overlay={overlay} {...wheels} />}
    </OverlaySheet>
  );
}

function DateWheels({
  overlay,
  value,
  min,
  max,
  formatYear = (year) => String(year).slice(-2),
  onSave,
}: Omit<DatePickerSheetProps, 'title' | 'description'>) {
  const lower = parseYmd(min);
  const upper = parseYmd(max);

  const [start] = useState<Ymd>(() => {
    const today = todayKst();
    let iso = parseYmd(value) ? value : today;
    if (min && iso < min) iso = min;
    if (max && iso > max) iso = max;
    return parseYmd(iso)!;
  });
  const [year, setYear] = useState(start.y);
  const [month, setMonth] = useState(start.m);
  const [day, setDay] = useState(start.d);

  const years = useMemo(
    () => range(lower?.y ?? start.y - YEARS_AROUND, upper?.y ?? start.y + YEARS_AROUND),
    [lower?.y, upper?.y, start.y],
  );
  // Out-of-range picks are clamped during render rather than synced in an effect
  const y = clampTo(years, year);
  const months = range(lower && y === lower.y ? lower.m : 1, upper && y === upper.y ? upper.m : 12);
  const m = clampTo(months, month);
  const days = range(
    lower && y === lower.y && m === lower.m ? lower.d : 1,
    upper && y === upper.y && m === upper.m ? upper.d : daysInMonth(y, m),
  );
  const d = clampTo(days, day);

  return (
    <>
      <div className={styles.wheels}>
        <div className={styles.band} aria-hidden />
        <span className={`${styles.line} ${styles.lineStart}`} aria-hidden />
        <span className={`${styles.line} ${styles.lineEnd}`} aria-hidden />
        <Wheel
          label="연도"
          unit="년"
          values={years}
          value={y}
          onChange={setYear}
          format={formatYear}
        />
        <Wheel label="월" unit="월" values={months} value={m} onChange={setMonth} />
        <Wheel label="일" unit="일" values={days} value={d} onChange={setDay} />
      </div>
      <button
        type="button"
        className={styles.save}
        onClick={() => {
          onSave(toIso({ y, m, d }));
          overlay.close();
        }}
      >
        저장
      </button>
    </>
  );
}

/**
 * Scroll-snap wheel: three rows, the middle one is the choice. A mouse wheel or trackpad gesture
 * moves exactly one row (debounced), touch flicks stop on every row (`scroll-snap-stop`), and
 * arrow keys step one row too.
 */
function Wheel({
  label,
  unit,
  values,
  value,
  onChange,
  format = String,
}: {
  label: string;
  unit: string;
  values: number[];
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const idPrefix = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const gestureTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Set while a wheel gesture is running: its later events don't move the wheel again */
  const gestureActive = useRef(false);
  /** Skip the programmatic scroll when the change came from the user scrolling the list */
  const scrolledByUser = useRef(false);
  const index = Math.max(0, values.indexOf(value));

  // Latest values for the native wheel listener, which is attached once
  const latest = useRef({ values, index, onChange });
  useEffect(() => {
    latest.current = { values, index, onChange };
  });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (scrolledByUser.current) {
      scrolledByUser.current = false;
      return;
    }
    const top = index * ROW_HEIGHT;
    if (Math.round(list.scrollTop) !== top) list.scrollTop = top;
  }, [index, values.length]);

  // React's onWheel is passive, so it can't stop the native multi-row scroll; listen natively
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      clearTimeout(gestureTimer.current);
      gestureTimer.current = setTimeout(() => {
        gestureActive.current = false;
      }, WHEEL_GESTURE_MS);
      if (gestureActive.current) return;
      gestureActive.current = true;
      const { values: current, index: at, onChange: change } = latest.current;
      const next = current[Math.min(current.length - 1, Math.max(0, at + Math.sign(event.deltaY)))];
      if (next !== undefined && next !== current[at]) change(next);
    };
    list.addEventListener('wheel', onWheel, { passive: false });
    return () => list.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(settleTimer.current);
      clearTimeout(gestureTimer.current);
    },
    [],
  );

  /** Touch / scrollbar scrolling: once it settles, the row under the band is the choice */
  function onScroll() {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const list = listRef.current;
      if (!list) return;
      const nextIndex = Math.min(
        values.length - 1,
        Math.max(0, Math.round(list.scrollTop / ROW_HEIGHT)),
      );
      list.scrollTop = nextIndex * ROW_HEIGHT;
      const next = values[nextIndex];
      if (next !== undefined && next !== value) {
        scrolledByUser.current = true;
        onChange(next);
      }
    }, SCROLL_SETTLE_MS);
  }

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = values[Math.min(values.length - 1, Math.max(0, index + step))];
    if (next !== undefined) onChange(next);
  }

  return (
    <ul
      ref={listRef}
      className={styles.wheel}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${idPrefix}-${value}`}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
    >
      {values.map((option) => (
        <li key={option} role="none" className={styles.row}>
          <button
            id={`${idPrefix}-${option}`}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={option === value}
            className={styles.option}
            onClick={() => onChange(option)}
          >
            {format(option)}
            <span className="sr-only">{unit}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
