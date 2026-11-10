'use client';

import { ThinkingOrb } from 'thinking-orbs';

import { AiSummarySheet } from '../ai-summary-sheet';

import styles from './AiSummaryFab.module.css';
import { useAiSummaryFab } from './hook';

/**
 * Floating "AI 채팅 요약" (Figma 750:3125). Keeps the existing summary flow.
 * The mark is the header's animated orb (user request 2026-11-10) instead of the static logo: light
 * ink for the dark FAB, and a busier animation while the summary is loading. It pauses offscreen and
 * shows a still frame under prefers-reduced-motion.
 */
export function AiSummaryFab({ roomId }: { roomId: number }) {
  const { onClick, pending, panel, result } = useAiSummaryFab(roomId);
  return (
    <>
      <div className={styles.fab}>
        <span className={styles.tooltip} aria-hidden="true">
          <span className={styles.label}>AI 채팅 요약</span>
        </span>
        <button
          type="button"
          className={styles.button}
          onClick={onClick}
          disabled={pending}
          aria-busy={pending}
        >
          <ThinkingOrb
            state={pending ? 'working' : 'connecting'}
            size={32}
            theme="dark"
            speed={0.55}
            dots={1.5}
            opts={{ lineW: 4.4, thr: 1, signals: 8 }}
            className={styles.logo}
            aria-hidden
          />
          <span className="sr-only">AI 채팅 요약</span>
        </button>
      </div>
      <AiSummarySheet overlay={panel} result={result} />
    </>
  );
}
