'use client';

import { useOverlay } from '@/lib/navigation/use-overlay';

import { sharedSummary } from '../ai-summary-fab/api';

import styles from './AiSummaryCard.module.css';

/** `AI_SUMMARY` chat message: the shared minutes' one line and counts. Tap opens the full minutes. */
export function AiSummaryCard({ messageId, payload }: { messageId: number; payload: unknown }) {
  const sheet = useOverlay('ai-summary-card');
  const summary = sharedSummary(payload);
  if (!summary) return <p className={styles.unavailable}>볼 수 없는 AI 요약이에요</p>;
  const counts = [
    summary.decisions.length && `결정 ${summary.decisions.length}`,
    summary.actionItems.length && `할 일 ${summary.actionItems.length}`,
    summary.openQuestions.length && `질문 ${summary.openQuestions.length}`,
  ].filter(Boolean);
  return (
    <button type="button" className={styles.card} onClick={() => sheet.open(String(messageId))}>
      <span className={styles.label}>AI 요약</span>
      <span className={styles.line}>{summary.oneLine}</span>
      {counts.length > 0 && <span className={styles.counts}>{counts.join(' · ')}</span>}
      <span className="sr-only">, 회의록 전체 보기</span>
    </button>
  );
}
