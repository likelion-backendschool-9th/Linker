'use client';

import { useAppBack } from '@/lib/navigation/use-app-back';

import { LoadingOrb } from './LoadingOrb';
import styles from './PageLoading.module.css';

/**
 * Load timed out (Figma 301:326): the loading screen with the orb stopped and a "돌아가기" button at
 * the bottom that goes back to the previous page (or the feed when there is none).
 */
export function PageLoadTimeout({ onBack }: { onBack?: () => void }) {
  const back = useAppBack('/feed');

  return (
    <div className={styles.screen} role="alert">
      <LoadingOrb paused />
      <span className="sr-only">네트워크 연결 시간이 초과되었습니다.</span>
      <button
        type="button"
        className={styles.back}
        onClick={() => {
          onBack?.();
          back();
        }}
      >
        돌아가기
      </button>
    </div>
  );
}
