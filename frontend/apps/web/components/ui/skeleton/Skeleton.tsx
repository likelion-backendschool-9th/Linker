import { LoadingOrb } from '../page-loading/LoadingOrb';
import styles from '../page-loading/PageLoading.module.css';

type SkeletonProps = {
  /** Kept for existing call sites; every section now shows the same loading orb */
  variant?: 'card' | 'line';
  count?: number;
};

/**
 * Section loading (Suspense fallbacks, `isPending` regions): the "working" orb from the full-screen
 * loading (Figma 301:294), centered in the section instead of skeleton bars. Hidden from screen
 * readers; the region sets `aria-busy`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Skeleton(_props: SkeletonProps) {
  return (
    <div className={styles.inline} aria-hidden>
      <LoadingOrb />
    </div>
  );
}
