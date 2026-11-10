'use client';

import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';

import styles from '../profile.module.css';
import { CONTRIBUTION_WEEKDAYS, useContributionCalendar } from './hook';

export function ContributionCalendar({ login, compact = false }: { login: string; compact?: boolean }) {
  const {
    contributions,
    data,
    year,
    monthNumber,
    firstOffset,
    totalDays,
    dayCounts,
    total,
    monthKey,
    currentMonth,
    minimumMonth,
    prevMonth,
    nextMonth,
  } = useContributionCalendar(login);

  if (contributions.isPending) {
    return (
      <section className={compact ? styles.compactCalendar : styles.section} aria-labelledby="contribution-title">
        <h2 id="contribution-title" className={compact ? 'sr-only' : undefined}>
          GitHub 기여
        </h2>
        <p role="status">기여 기록을 불러오고 있어요.</p>
      </section>
    );
  }
  if (contributions.isError) {
    return (
      <section className={compact ? styles.compactCalendar : styles.section} aria-labelledby="contribution-title">
        <h2 id="contribution-title" className={compact ? 'sr-only' : undefined}>
          GitHub 기여
        </h2>
        <p className={styles.error} role="status">
          기여 기록을 불러오지 못했어요.
        </p>
      </section>
    );
  }
  if (!data) return null;

  return (
    <section
      className={compact ? styles.compactCalendar : styles.section}
      aria-labelledby="contribution-title"
    >
      <div className={styles.calendarHeader}>
        <h2 id="contribution-title" className={compact ? 'sr-only' : undefined}>
          GitHub 기여
        </h2>
        <div>
          <button
            type="button"
            aria-label="이전 달"
            disabled={monthKey <= minimumMonth}
            onClick={prevMonth}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="다음 달"
            disabled={monthKey >= currentMonth}
            onClick={nextMonth}
          >
            ›
          </button>
        </div>
      </div>
      <p>
        {year}년 {monthNumber}월 · 기여 {total}회
      </p>
      <p className={styles.meta}>
        <RelativeTime value={data.asOf} /> 기준
      </p>
      <p className={styles.meta}>커밋에 쓴 이메일이 GitHub 계정에 등록돼 있어야 잔디에 잡혀요.</p>
      <ul className={styles.calendar} aria-label={`${year}년 ${monthNumber}월 기여 달력`}>
        {CONTRIBUTION_WEEKDAYS.map((day) => (
          <li className={styles.weekday} key={day}>
            {day}
          </li>
        ))}
        {Array.from({ length: firstOffset }, (_, index) => (
          <li className={styles.emptyDay} aria-hidden key={`empty-${index}`} />
        ))}
        {Array.from({ length: totalDays }, (_, index) => {
          const day = index + 1;
          const key = `${data.month}-${String(day).padStart(2, '0')}`;
          const count = dayCounts.get(key) ?? 0;
          const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 9 ? 3 : 4;
          return (
            <li
              className={styles.day}
              data-level={level}
              key={key}
              aria-label={`${day}일 기여 ${count}회`}
              title={`${count}회`}
            />
          );
        })}
      </ul>
      {contributions.isError && (
        <p className={styles.error} role="status">
          기여 기록을 불러오지 못했어요.
        </p>
      )}
    </section>
  );
}
