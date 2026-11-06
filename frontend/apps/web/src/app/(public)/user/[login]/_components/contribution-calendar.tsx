'use client';

import { listPublicContributions } from '@linker/api/p04-profile/p04-profile';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { parseAsString, useQueryState } from 'nuqs';

import { RelativeTime } from '@/components/ui/relative-time';
import { toKst } from '@/lib/format/time';

import styles from './profile.module.css';

type ContributionResponse = {
  month: string;
  days: { date: string; count: number }[];
  asOf: string;
};

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function shiftMonth(month: string, by: number) {
  const [year, value] = month.split('-').map(Number) as [number, number];
  const next = new Date(year, value - 1 + by, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

export function ContributionCalendar({ login }: { login: string }) {
  const currentMonth = format(toKst(new Date()), 'yyyy-MM');
  const [month, setMonth] = useQueryState(
    'contributionMonth',
    parseAsString.withDefault(currentMonth).withOptions({ shallow: true, history: 'replace' }),
  );
  const monthKey = /^\d{4}-\d{2}$/.test(month) ? month : currentMonth;
  const contributions = useQuery({
    queryKey: ['profile-contributions', login, monthKey],
    queryFn: async () => {
      const data = await listPublicContributions(login, { month: monthKey });
      if (!data.month || !data.asOf) return null;
      const days = (data.days ?? []).flatMap((day) =>
        day.date != null && day.count != null ? [{ date: day.date, count: day.count }] : [],
      );
      return { month: data.month, asOf: data.asOf, days };
    },
  });

  if (contributions.isPending) {
    return (
      <section className={styles.section} aria-labelledby="contribution-title">
        <h2 id="contribution-title">GitHub 기여</h2>
        <p role="status">기여 기록을 불러오고 있어요.</p>
      </section>
    );
  }
  if (!contributions.data) return null;

  const data = contributions.data;
  const [year, monthNumber] = data.month.split('-').map(Number) as [number, number];
  const firstOffset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const totalDays = new Date(year, monthNumber, 0).getDate();
  const dayCounts = new Map(data.days.map((day) => [day.date, day.count]));
  const total = data.days.reduce((sum, day) => sum + day.count, 0);
  const minimumMonth = shiftMonth(currentMonth, -11);

  return (
    <section className={styles.section} aria-labelledby="contribution-title">
      <div className={styles.calendarHeader}>
        <h2 id="contribution-title">GitHub 기여</h2>
        <div>
          <button
            type="button"
            aria-label="이전 달"
            disabled={monthKey <= minimumMonth}
            onClick={() => void setMonth(shiftMonth(monthKey, -1))}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="다음 달"
            disabled={monthKey >= currentMonth}
            onClick={() => void setMonth(shiftMonth(monthKey, 1))}
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
        {WEEKDAYS.map((day) => (
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
