// real reuse: traffic sources, daily views, and weekly recruiter counts
import styles from './stats.module.css';

export function StatsChart({
  title,
  summary,
  rows,
  trend = false,
}: {
  title: string;
  summary: string;
  rows: { label: string; value: number }[];
  trend?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const points = rows
    .map(
      (row, i) =>
        `${20 + (i / Math.max(1, rows.length - 1)) * 560},${160 - (row.value / max) * 140}`,
    )
    .join(' ');
  return (
    <figure className={styles.figure}>
      <figcaption>{title}</figcaption>
      <p className={styles.description}>{summary}</p>
      {trend ? (
        <svg className={styles.graph} viewBox="0 0 600 180" role="img" aria-label={summary}>
          <line className={styles.axis} x1="20" y1="160" x2="580" y2="160" aria-hidden />
          <polyline className={styles.line} points={points} aria-hidden />
        </svg>
      ) : (
        <ul className={styles.bars}>
          {rows.map((row) => (
            <li key={row.label} className={styles.barRow}>
              <span>{row.label}</span>
              <svg
                className={styles.bar}
                viewBox="0 0 100 12"
                preserveAspectRatio="none"
                role="img"
                aria-label={`${row.label} ${row.value}회`}
              >
                <rect className={styles.track} width="100" height="12" rx="6" aria-hidden />
                <rect
                  className={styles.fill}
                  width={(row.value / max) * 100}
                  height="12"
                  rx="6"
                  aria-hidden
                />
              </svg>
              <span>{row.value.toLocaleString('ko-KR')}회</span>
            </li>
          ))}
        </ul>
      )}
      <details className={styles.details}>
        <summary>표로 보기</summary>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <caption>{title} 상세 수치</caption>
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">횟수</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value.toLocaleString('ko-KR')}회</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
