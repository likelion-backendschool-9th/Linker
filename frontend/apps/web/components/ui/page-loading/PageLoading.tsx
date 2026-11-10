import { LoadingOrb } from './LoadingOrb';
import styles from './PageLoading.module.css';

/**
 * Full-screen loading (Figma 301:294): a white screen with the "working" orb in the middle, no header.
 * Used by every route `loading.tsx`.
 */
export function PageLoading() {
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <LoadingOrb />
      <span className="sr-only">불러오는 중이에요</span>
    </div>
  );
}
