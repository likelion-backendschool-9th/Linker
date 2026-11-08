'use client';

import Image from 'next/image';

import styles from './AiSummaryFab.module.css';
import { useAiSummaryFab } from './hook';

/**
 * "AI 채팅 요약" (Figma 248:1236) as a logo button left of the send button. The floating label
 * covered messages, so the name is screen-reader only. AI summary is [Included]: it only says it
 * isn't built yet.
 */
export function AiSummaryFab() {
  const { onClick } = useAiSummaryFab();
  return (
    <button type="button" className={styles.button} onClick={onClick}>
      <Image src="/logo.svg" alt="" width={33} height={33} className={styles.logo} />
      <span className="sr-only">AI 채팅 요약</span>
    </button>
  );
}
