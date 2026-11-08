import type { IssueProgressDay } from '@linker/api/openAPIDefinition.schemas';
import type { CSSProperties } from 'react';

import styles from './IssueTrendChart.module.css';
import { linePath } from './trend-path';

/** The three lines of the Figma legend (완료 · 진행 · 정지) */
const SERIES = [
  { key: 'done', word: '완료', tone: 'done' },
  { key: 'inProgress', word: '진행', tone: 'active' },
  { key: 'blocked', word: '정지', tone: 'blocked' },
] as const;
type SeriesKey = (typeof SERIES)[number]['key'];

/** Plot coordinates are 0–100 on both axes; the SVG stretches and keeps 2px lines. */
const TOP_ROOM = 8;

function xAt(index: number, count: number) {
  return count <= 1 ? 50 : (index / (count - 1)) * 100;
}

function dayLabel(date: string, isToday: boolean) {
  return isToday ? '오늘' : `${Number(date.slice(8, 10))}일`;
}

/**
 * "최근 추이" of Figma 11: day lines every other day ending on 오늘, three smooth monotone lines (never past the day values), today's
 * points marked. The picture is hidden from screen readers; a summary sentence and a table carry the
 * same numbers (POL-T-7 accessibility). Days not collected yet are `null` and leave a gap.
 */
export function IssueTrendChart({ history }: { history: IssueProgressDay[] }) {
  const count = history.length;
  const values = history.flatMap((day) => SERIES.map((series) => day[series.key] ?? 0));
  const max = Math.max(1, ...values);
  const yAt = (value: number) => TOP_ROOM + (1 - value / max) * (100 - TOP_ROOM);
  const pointsOf = (key: SeriesKey) =>
    history.map((day, index) => {
      const value = day[key];
      return value === null ? null : { x: xAt(index, count), y: yAt(value) };
    });
  // Every other day, counted back from today, as in the Figma axis
  const labeled = history
    .map((day, index) => ({ day, index }))
    .filter(({ index }) => (count - 1 - index) % 2 === 0);
  const last = history[count - 1];
  const first = history[0];

  return (
    <figure className={styles.chart}>
      <div className={styles.plot}>
        <svg
          className={styles.svg}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          focusable="false"
        >
          {labeled.map(({ index }) => (
            <line
              key={index}
              className={styles.grid}
              x1={xAt(index, count)}
              x2={xAt(index, count)}
              y1={0}
              y2={100}
            />
          ))}
          {SERIES.map((series) => (
            <path
              key={series.key}
              className={`${styles.line} ${styles[series.tone]}`}
              d={linePath(pointsOf(series.key))}
            />
          ))}
        </svg>
        {last &&
          SERIES.map((series) => {
            const value = last[series.key];
            if (value === null) return null;
            const style = {
              '--point-x': `${xAt(count - 1, count)}%`,
              '--point-y': `${yAt(value)}%`,
            } as CSSProperties;
            return (
              <span
                key={series.key}
                aria-hidden
                className={`${styles.point} ${styles[series.tone]}`}
                style={style}
              />
            );
          })}
      </div>
      <ol className={styles.axis} aria-hidden>
        {labeled.map(({ day, index }) => (
          <li
            key={day.date}
            className={index === count - 1 ? styles.today : styles.tick}
            style={{ '--point-x': `${xAt(index, count)}%` } as CSSProperties}
          >
            {dayLabel(day.date, index === count - 1)}
          </li>
        ))}
      </ol>
      <ul className={styles.legend} aria-hidden>
        {SERIES.map((series) => (
          <li key={series.key} className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles[series.tone]}`} />
            {series.word}
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">
        {first && last
          ? `최근 ${count}일 이슈 추이. ${SERIES.map(
              (series) =>
                `${series.word} ${first[series.key] ?? '기록 없음'}에서 ${last[series.key] ?? '기록 없음'}`,
            ).join(', ')}.`
          : '최근 이슈 추이 기록이 없어요.'}
      </figcaption>
      <table className="sr-only">
        <caption>날짜별 이슈 수</caption>
        <thead>
          <tr>
            <th scope="col">날짜</th>
            {SERIES.map((series) => (
              <th key={series.key} scope="col">
                {series.word}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((day) => (
            <tr key={day.date}>
              <th scope="row">
                <time dateTime={day.date}>{day.date}</time>
              </th>
              {SERIES.map((series) => (
                <td key={series.key}>{day[series.key] ?? '기록 없음'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
