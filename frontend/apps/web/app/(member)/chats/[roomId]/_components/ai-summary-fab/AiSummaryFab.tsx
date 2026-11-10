'use client';

import Image from 'next/image';

import { AiSummarySheet } from '../ai-summary-sheet';

import styles from './AiSummaryFab.module.css';
import { useAiSummaryFab } from './hook';

/**
 * Floating "AI 채팅 요약" (Figma 750:3125). Keeps the existing summary flow.
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
          <Image src="/logo.svg" alt="" width={33} height={33} className={styles.logo} />
          <span className="sr-only">AI 채팅 요약</span>
        </button>
      </div>
      <AiSummarySheet overlay={panel} result={result} />
    </>
  );
}
