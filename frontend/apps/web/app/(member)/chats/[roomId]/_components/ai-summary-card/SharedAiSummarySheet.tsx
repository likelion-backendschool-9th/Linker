'use client';

import { useOverlay } from '@/lib/navigation/use-overlay';

import type { RoomMessage } from '../../_lib/room-api';
import { sharedSummary } from '../ai-summary-fab/api';
import { AiSummarySheet } from '../ai-summary-sheet';

/** Full paragraph of a shared `AI_SUMMARY` card (?overlay=ai-summary-card&oid={messageId}). */
export function SharedAiSummarySheet({ messages }: { messages: RoomMessage[] }) {
  const overlay = useOverlay('ai-summary-card');
  const message = overlay.id ? messages.find((item) => String(item.id) === overlay.id) : undefined;
  const summary =
    message &&
    message.type === 'AI_SUMMARY' &&
    !message.deletedAt &&
    message.visibility === 'VISIBLE'
      ? sharedSummary(message.payload)
      : null;
  return <AiSummarySheet overlay={overlay} summary={summary} />;
}
