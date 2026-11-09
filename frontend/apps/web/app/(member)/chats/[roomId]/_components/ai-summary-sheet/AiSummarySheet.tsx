'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';

import type { AiChatSummary } from '../ai-summary-fab/api';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from './AiSummarySheet.module.css';

/**
 * AI summary result panel (Figma 351:362 / 351:560). One body string + disclaimer.
 * Flex/loading chrome has no Figma — confirm with 준호.
 */
export function AiSummarySheet({
  overlay,
  result,
}: {
  overlay: OverlayControl;
  result: AiChatSummary | null;
}) {
  return (
    <OverlaySheet
      overlay={overlay}
      title="AI 요약"
      description="팀 채팅 요약 결과예요."
      describeHidden
    >
      {!result || result.status !== 'DONE' ? (
        <p role="status">요약하는 중이에요</p>
      ) : (
        <div className={styles.body}>
          <p className={styles.summary}>{result.summary}</p>
          <p className={styles.meta}>
            {result.usedToday}/{result.limit} · 메시지 {result.messageCount}개
          </p>
          <p className={styles.disclaimer}>{result.disclaimer}</p>
        </div>
      )}
    </OverlaySheet>
  );
}
