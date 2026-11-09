'use client';

import { useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { todayKst } from '@/lib/format/time';

import styles from '../issue-sheets.module.css';
import { dateSheetClassNames } from '../sheet-class-names';
import {
  useIssueScheduleForm,
  useIssueScheduleSheet,
  type IssueScheduleSheetProps,
  type SchedulePart,
} from './hook';

const TITLE: Record<SchedulePart, string> = { start: '시작일', due: '마감일' };

export function IssueScheduleSheet({ value, onSave, part = 'start' }: IssueScheduleSheetProps) {
  const overlay = useIssueScheduleSheet();
  const title = TITLE[part];
  return (
    <OverlaySheet
      overlay={overlay}
      title={title}
      description={title}
      describeHidden
      classNames={dateSheetClassNames}
    >
      {overlay.isOpen && (
        <ScheduleForm part={part} value={value} onSave={onSave} onDone={overlay.close} />
      )}
    </OverlaySheet>
  );
}

function ScheduleForm({
  part,
  value,
  onSave,
  onDone,
}: IssueScheduleSheetProps & { part: SchedulePart; onDone: () => void }) {
  const {
    start,
    due,
    orderError,
    askPast,
    pending,
    error,
    dueRef,
    id,
    onStartChange,
    onDueChange,
    submit,
  } = useIssueScheduleForm({ value, onSave, onDone });
  const current = part === 'due' ? due : start;
  const onChange = part === 'due' ? onDueChange : onStartChange;

  return (
    <form className={`${styles.form} ${styles.dateForm}`} noValidate onSubmit={submit}>
      <DateWheel
        label={TITLE[part]}
        value={current}
        describedBy={orderError ? `${id}-order` : undefined}
        invalid={orderError}
        wheelRef={dueRef}
        onChange={onChange}
      />
      {orderError && (
        <p id={`${id}-order`} className={styles.error}>
          마감일은 시작일과 같거나 그 뒤여야 해요.
        </p>
      )}
      {askPast && (
        <p className={styles.warning} role="alert">
          이미 지난 날짜예요. 이대로 저장하려면 한 번 더 눌러 주세요.
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="submit" className={styles.save} aria-disabled={pending}>
        {pending ? '저장하는 중…' : askPast ? '지난 날짜로 저장' : '저장'}
      </button>
    </form>
  );
}

function parseYmd(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function DateWheel({
  label,
  value,
  onChange,
  wheelRef,
  invalid,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  wheelRef: RefObject<HTMLElement | null>;
  invalid: boolean;
  describedBy?: string;
}) {
  const today = parseYmd(todayKst()) ?? { y: 2026, m: 1, d: 1 };
  const parsed = parseYmd(value);
  const year = parsed?.y ?? today.y;
  const month = parsed?.m ?? today.m;
  const day = Math.min(parsed?.d ?? today.d, daysInMonth(year, month));
  const minYear = Math.min(today.y - 30, year);
  const maxYear = Math.max(today.y + 80, year);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);

  function emit(next: { y: number; m: number; d: number }) {
    const last = daysInMonth(next.y, next.m);
    const clamped = Math.min(next.d, last);
    onChange(`${next.y}-${pad(next.m)}-${pad(clamped)}`);
  }

  return (
    <div className={styles.wheels}>
      <div className={styles.band} aria-hidden />
      <WheelColumn
        label="년"
        values={years}
        value={year}
        text={(item) => String(item).slice(-2)}
        name={(item) => `${item}년`}
        onPick={(item) => emit({ y: item, m: month, d: day })}
      />
      <WheelColumn
        label="월"
        values={Array.from({ length: 12 }, (_, index) => index + 1)}
        value={month}
        text={(item) => String(item)}
        name={(item) => `${item}월`}
        onPick={(item) => emit({ y: year, m: item, d: day })}
      />
      <WheelColumn
        label={label}
        values={Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1)}
        value={day}
        text={(item) => String(item)}
        name={(item) => `${item}일`}
        invalid={invalid}
        describedBy={describedBy}
        listRef={wheelRef}
        onPick={(item) => emit({ y: year, m: month, d: item })}
      />
    </div>
  );
}

function WheelColumn({
  label,
  values,
  value,
  text,
  name,
  onPick,
  listRef,
  invalid,
  describedBy,
}: {
  label: string;
  values: number[];
  value: number;
  text: (item: number) => string;
  name: (item: number) => string;
  onPick: (item: number) => void;
  listRef?: RefObject<HTMLElement | null>;
  invalid?: boolean;
  describedBy?: string;
}) {
  const ownRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const list = ownRef.current;
    const row = list?.querySelector('[aria-selected="true"]')?.parentElement;
    if (!list || !(row instanceof HTMLElement)) return;
    list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.clientHeight / 2;
  }, [value]);

  function setList(node: HTMLDivElement | null) {
    ownRef.current = node;
    if (listRef) listRef.current = node;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = values.indexOf(value);
    const next = values[Math.min(values.length - 1, Math.max(0, index + step))];
    if (next !== undefined) onPick(next);
  }

  // div+option (not ul/li): listbox may only contain option children (axe aria-required-children)
  return (
    <div
      ref={setList}
      className={styles.wheel}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
    >
      {values.map((item) => (
        <div key={item} className={styles.wheelRow} role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={item === value}
            className={styles.wheelOption}
            onClick={() => onPick(item)}
          >
            <span className="sr-only">{name(item)}</span>
            <span aria-hidden="true">{text(item)}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
