'use client';

import type { KeyboardEvent } from 'react';

import { formatMessageTime, toKstIso } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { useMessageMenu } from '../../_hooks/use-message-menu';
import type { RoomMessage } from '../../_lib/room-api';
import { sharedSummary } from '../ai-summary-fab/api';

import styles from './AiSummaryCard.module.css';

type Props = {
  message: RoomMessage;
  /** Shown as "{name}님이 AI 요약을 공유했어요" */
  senderName: string;
  /** Shared cards can be reported or deleted like any message (POL-C-5) */
  canMenu: boolean;
  onMenu?: (id: number) => void;
};

/**
 * A shared `AI_SUMMARY` message as a centered, full-width card like the PR cards (user decision
 * 2026-11-10): who shared it, the one line (two lines at most) and counts. Tap opens the full minutes;
 * long press, right click, Shift+F10 or the context-menu key opens the message menu.
 */
export function AiSummaryCard({ message, senderName, canMenu, onMenu }: Props) {
  const sheet = useOverlay('ai-summary-card');
  const summary = sharedSummary(message.payload);
  // Enter and Space open the minutes here, so the menu keeps only the dedicated menu keys (menuKeys)
  const press = { ...useMessageMenu(canMenu, () => onMenu?.(message.id)), onKeyDown: menuKeys };
  const time = (
    <time dateTime={toKstIso(message.createdAt)} title={toKstIso(message.createdAt)}>
      {formatMessageTime(message.createdAt)}
    </time>
  );

  if (!summary)
    return (
      <article className={styles.wrap}>
        <p className={styles.byline}>볼 수 없는 AI 요약이에요 · {time}</p>
      </article>
    );

  const counts = [
    summary.decisions.length && `결정 ${summary.decisions.length}`,
    summary.actionItems.length && `할 일 ${summary.actionItems.length}`,
    summary.openQuestions.length && `질문 ${summary.openQuestions.length}`,
  ].filter(Boolean);

  function menuKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (!canMenu || event.repeat) return;
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      onMenu?.(message.id);
    }
  }

  return (
    <article className={styles.wrap} aria-label={`${senderName}님이 공유한 AI 요약`}>
      <p className={styles.byline}>
        {senderName}님이 AI 요약을 공유했어요 · {time}
      </p>
      <button
        type="button"
        className={styles.card}
        aria-haspopup="dialog"
        aria-keyshortcuts={canMenu ? 'Shift+F10' : undefined}
        {...press}
        onClick={() => sheet.open(String(message.id))}
      >
        <span className={styles.label}>AI 요약</span>
        <span className={styles.line}>{summary.oneLine}</span>
        <span className={styles.footer}>
          <span className={styles.counts}>{counts.join(' · ')}</span>
          <span className={styles.more} aria-hidden="true">
            회의록 보기 ›
          </span>
        </span>
        <span className="sr-only">, 회의록 전체 보기</span>
      </button>
      {canMenu && (
        <button
          type="button"
          className="sr-only"
          tabIndex={-1}
          aria-haspopup="dialog"
          aria-label={`${senderName} 메시지 메뉴`}
          onClick={() => onMenu?.(message.id)}
        >
          메시지 메뉴 열기
        </button>
      )}
    </article>
  );
}
