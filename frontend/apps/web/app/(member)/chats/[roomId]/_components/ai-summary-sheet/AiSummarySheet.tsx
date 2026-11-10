'use client';

import { RotateCw } from 'lucide-react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import type { AiChatSummary, SharedAiSummary } from '../ai-summary-fab/api';

import styles from './AiSummarySheet.module.css';

type Props = {
  overlay: OverlayControl;
  /** The requester's own summary, or the paragraph copied into a shared card */
  summary: AiChatSummary | SharedAiSummary | null;
  /** Own summary only: "새로 요약 받기" beside the title and "채팅창에 공유하기" */
  actions?: { sharing: boolean; onShare: () => void; onRenew: () => void };
};

/**
 * AI summary panel (Figma 351:362, user decision 2026-11-11): "AI 요약" with "새로 요약 받기" beside it,
 * one paragraph, and "채팅창에 공유하기". No usage count or disclaimer line.
 */
export function AiSummarySheet({ overlay, summary, actions }: Props) {
  const own = summary && 'summaryId' in summary ? summary : null;
  const text = summary?.summary ?? null;
  const ready = !!text && (!own || own.status === 'DONE');
  const ownActions = own && actions && ready ? actions : null;
  return (
    <OverlaySheet
      overlay={overlay}
      title="AI 요약"
      titleAside={
        ownActions && (
          <button type="button" className={styles.renew} onClick={ownActions.onRenew}>
            새로 요약 받기
            <RotateCw aria-hidden className={styles.renewIcon} />
          </button>
        )
      }
      description="팀 채팅 요약이에요."
      describeHidden
      classNames={{
        scrim: styles.scrim,
        sheet: styles.sheet,
        title: styles.title,
        body: styles.sheetBody,
      }}
    >
      {own && own.status === 'FAILED' ? (
        <p role="status" className={styles.notice}>
          요약하지 못했어요
        </p>
      ) : !ready ? (
        <p role="status" className={styles.notice}>
          요약하는 중이에요
        </p>
      ) : (
        <div className={styles.body}>
          <p className={styles.summary}>{text}</p>
          {ownActions && (
            <button
              type="button"
              className={styles.share}
              aria-disabled={ownActions.sharing}
              onClick={ownActions.onShare}
            >
              채팅창에 공유하기
            </button>
          )}
        </div>
      )}
    </OverlaySheet>
  );
}
