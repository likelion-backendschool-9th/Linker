import { RefreshCw } from 'lucide-react';
import type { CSSProperties } from 'react';

import { PULL_MAX } from '../_hooks/use-pull-to-refresh';
import styles from './pull-indicator.module.css';

type PullIndicatorProps = {
  /** Current pull distance in px (0 = hidden) */
  distance: number;
  ready: boolean;
  /** Seconds until refresh is allowed again; null when allowed */
  waitSeconds: number | null;
};

/**
 * What the pull gesture will do. Visual only (`aria-hidden`): the "새로 고침" button next to it
 * says the same and the result is announced by a toast. Moves with transform/opacity only.
 */
export function PullIndicator({ distance, ready, waitSeconds }: PullIndicatorProps) {
  const label =
    waitSeconds !== null
      ? `${waitSeconds}초 후에 새로 고칠 수 있어요`
      : ready
        ? '놓으면 새로 고침'
        : '당겨서 새로 고침';
  const style = {
    '--pull-distance': `${distance}px`,
    '--pull-progress': String(Math.min(distance / PULL_MAX, 1)),
  } as CSSProperties;

  return (
    <div className={styles.indicator} style={style} aria-hidden data-active={distance > 0}>
      <span className={styles.pill}>
        <RefreshCw className={styles.icon} />
        {label}
      </span>
    </div>
  );
}
