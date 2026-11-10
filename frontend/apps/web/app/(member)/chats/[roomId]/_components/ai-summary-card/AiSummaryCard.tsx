'use client';

import type { KeyboardEvent } from 'react';

import { useOverlay } from '@/lib/navigation/use-overlay';

import { useMessageMenu } from '../../_hooks/use-message-menu';
import type { RoomMessage } from '../../_lib/room-api';
import { sharedSummary } from '../ai-summary-fab/api';

import styles from './AiSummaryCard.module.css';

type Props = {
  message: RoomMessage;
  /** Shared cards can be reported or deleted like any message (POL-C-5) */
  canMenu: boolean;
  onMenu?: (id: number) => void;
};

/**
 * A shared `AI_SUMMARY` message in the bubble slot of a normal message (user decision 2026-11-11): a
 * light card with "AI 채팅 요약" and the paragraph. Tap opens the full summary; long press, right click,
 * Shift+F10 or the context-menu key opens the message menu.
 */
export function AiSummaryCard({ message, canMenu, onMenu }: Props) {
  const sheet = useOverlay('ai-summary-card');
  const summary = sharedSummary(message.payload);
  // Enter and Space open the summary here, so the menu keeps only the dedicated menu keys (menuKeys)
  const press = { ...useMessageMenu(canMenu, () => onMenu?.(message.id)), onKeyDown: menuKeys };

  function menuKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (!canMenu || event.repeat) return;
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      onMenu?.(message.id);
    }
  }

  if (!summary) return <p className={styles.unavailable}>볼 수 없는 AI 요약이에요</p>;

  return (
    <button
      type="button"
      className={styles.card}
      aria-haspopup="dialog"
      aria-keyshortcuts={canMenu ? 'Shift+F10' : undefined}
      {...press}
      onClick={() => sheet.open(String(message.id))}
    >
      <span className={styles.label}>AI 채팅 요약</span>
      <span className={styles.text}>{summary.summary}</span>
      <span className="sr-only">, 요약 전체 보기</span>
    </button>
  );
}
