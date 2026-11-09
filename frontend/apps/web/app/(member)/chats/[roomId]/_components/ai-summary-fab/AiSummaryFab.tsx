'use client';

import Image from 'next/image';

import { AiSummarySheet } from '../ai-summary-sheet';

import styles from './AiSummaryFab.module.css';
import { useAiSummaryFab } from './hook';

/**
 * "AI 채팅 요약" (Figma 248:1236) left of send. Opens summary flow (POST → panel 351:362).
 */
export function AiSummaryFab({ roomId }: { roomId: number }) {
  const { onClick, pending, panel, result } = useAiSummaryFab(roomId);
  return (
    <>
      <button type="button" className={styles.button} onClick={onClick} disabled={pending} aria-busy={pending}>
        <Image src="/logo.svg" alt="" width={33} height={33} className={styles.logo} />
        <span className="sr-only">AI 채팅 요약</span>
      </button>
      <AiSummarySheet overlay={panel} result={result} />
    </>
  );
}
