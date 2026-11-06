import styles from './Skeleton.module.css';

type SkeletonProps = {
  /** Card-shaped block or a text line */
  variant?: 'card' | 'line';
  count?: number;
};

/** Loading placeholder for `loading.tsx` and Suspense fallbacks. Hidden from screen readers; the region sets `aria-busy`. */
export function Skeleton({ variant = 'card', count = 1 }: SkeletonProps) {
  return (
    <div className={styles.stack} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={`${styles.block} ${styles[variant]}`} />
      ))}
    </div>
  );
}
