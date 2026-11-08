'use client';

import Image from 'next/image';

import styles from './AiSummaryFab.module.css';
import { useAiSummaryFab } from './hook';

/** Figma 248:1236 "AI 채팅 요약" FAB. AI summary is [Included]: it only says it isn't built yet. */
export function AiSummaryFab() {
  const { onClick } = useAiSummaryFab();
  return (
    <button type="button" className={styles.fab} onClick={onClick}>
      <span className={styles.label}>
        <span className={styles.labelText}>AI 채팅 요약</span>
      </span>
      <span className={styles.circle} aria-hidden>
        <Image src="/logo.svg" alt="" width={33} height={33} className={styles.logo} />
      </span>
    </button>
  );
}
