'use client';

import { Button } from '@/components/ui/button/Button';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import type { AiChatSummary, AiSummaryItem, SharedAiSummary } from '../ai-summary-fab/api';

import styles from './AiSummarySheet.module.css';

type Props = {
  overlay: OverlayControl;
  /** The requester's own summary, or the minutes copied into a shared card */
  summary: AiChatSummary | SharedAiSummary | null;
  /** Source messages loaded in the timeline; only those lines can scroll to the original */
  loadedIds: ReadonlySet<number>;
  onJump: (messageId: number) => void;
  /** Own summary only: "채팅에 공유" and "새로 요약하기" */
  actions?: { sharing: boolean; onShare: () => void; onRenew: () => void };
};

const SECTIONS = [
  ['decisions', '결정한 것'],
  ['actionItems', '할 일'],
  ['openQuestions', '아직 정하지 못한 것'],
] as const;

/**
 * AI summary minutes (Figma 351:362 for the panel; sections per POL-C-5): one line, decisions, to-dos
 * and open questions. Tapping a line scrolls to its source message.
 */
export function AiSummarySheet({ overlay, summary, loadedIds, onJump, actions }: Props) {
  const own = summary && 'summaryId' in summary ? summary : null;
  return (
    <OverlaySheet
      overlay={overlay}
      title="AI 요약"
      description="팀 채팅 회의록이에요."
      describeHidden
    >
      {!summary || (own && own.status === 'PENDING') ? (
        <p role="status" className={styles.notice}>
          요약하는 중이에요
        </p>
      ) : own && own.status === 'FAILED' ? (
        <p role="status" className={styles.notice}>
          요약하지 못했어요
        </p>
      ) : (
        <div className={styles.body}>
          <p className={styles.summary}>{summary.oneLine}</p>
          {SECTIONS.map(([key, heading]) =>
            summary[key].length ? (
              <section key={key} className={styles.section} aria-label={heading}>
                <h3 className={styles.heading}>{heading}</h3>
                <ul className={styles.items}>
                  {summary[key].map((item, index) => (
                    <li key={`${index}-${item.text}`}>
                      <Line item={item} loadedIds={loadedIds} onJump={onJump} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}
          <p className={styles.meta}>
            최근 메시지 {summary.messageCount}개를 요약했어요
            {own ? ` · 오늘 ${own.usedToday}/${own.limit}회 사용` : ''}
          </p>
          <p className={styles.disclaimer}>{summary.disclaimer}</p>
          {own && actions && (
            <div className={styles.actions}>
              {own.sharedMessageId ? (
                <p className={styles.meta}>채팅에 공유한 요약이에요</p>
              ) : (
                <Button block aria-disabled={actions.sharing} onClick={actions.onShare}>
                  채팅에 공유
                </Button>
              )}
              <Button block variant="soft" onClick={actions.onRenew}>
                새로 요약하기
              </Button>
            </div>
          )}
        </div>
      )}
    </OverlaySheet>
  );
}

function Line({
  item,
  loadedIds,
  onJump,
}: {
  item: AiSummaryItem;
  loadedIds: ReadonlySet<number>;
  onJump: (messageId: number) => void;
}) {
  const target = item.messageId !== null && loadedIds.has(item.messageId) ? item.messageId : null;
  if (target === null) return <p className={styles.item}>{item.text}</p>;
  return (
    <button
      type="button"
      className={`${styles.item} ${styles.jump}`}
      onClick={() => onJump(target)}
    >
      {item.text}
      <span className="sr-only">, 원문 메시지로 이동</span>
    </button>
  );
}
