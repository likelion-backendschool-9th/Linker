import styles from './skeleton.module.css';

type SkeletonProps = {
  /** Card-shaped block or a text line */
  variant?: 'card' | 'line';
  count?: number;
  animated?: boolean;
};

/** Loading placeholder for `loading.tsx` and Suspense fallbacks. Hidden from screen readers; the region sets `aria-busy`. */
export function Skeleton({ variant = 'card', count = 1, animated = true }: SkeletonProps) {
  return (
    <div className={styles.stack} aria-hidden data-skeleton>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          data-skeleton-block
          className={`${styles.block} ${styles[variant]}${animated ? '' : ` ${styles.static}`}`}
        />
      ))}
    </div>
  );
}
