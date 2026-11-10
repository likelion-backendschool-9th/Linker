'use client';

import { SlidersHorizontal } from 'lucide-react';

import { useOverlay } from '@/lib/navigation/use-overlay';

import styles from './TeamChangeIconButton.module.css';

/**
 * Header icon of 11/14/15 (same SlidersHorizontal as the old filter). Opens the shared
 * "팀 변경" sheet already mounted by `TeamSwitcher` (`overlay=team-switcher`).
 */
export function TeamChangeIconButton() {
  const overlay = useOverlay('team-switcher');
  return (
    <button
      type="button"
      className={styles.icon}
      aria-haspopup="dialog"
      onClick={() => overlay.open()}
    >
      <SlidersHorizontal aria-hidden />
      <span className="sr-only">팀 변경</span>
    </button>
  );
}
