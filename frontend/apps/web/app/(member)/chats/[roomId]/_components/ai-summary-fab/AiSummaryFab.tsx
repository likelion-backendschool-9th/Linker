'use client';

import { useEffect, useId, useRef } from 'react';
import { ThinkingOrb } from 'thinking-orbs';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog';

import { AiSummarySheet } from '../ai-summary-sheet';

import styles from './AiSummaryFab.module.css';
import { useAiSummaryFab, type AiSummaryRing } from './hook';

type Props = {
  roomId: number;
  initial: { summaryId: number; status: string } | null | undefined;
};

/**
 * Floating "AI 채팅 요약" (Figma 750:3125) with a progress ring (POL-C-5, user decision 2026-11-10):
 * spinning while queued, blue filling clockwise while the model works, full blue until the result is
 * shared or replaced, red after a failure. Tapping while it runs shows a progress bubble.
 */
export function AiSummaryFab({ roomId, initial }: Props) {
  const fab = useAiSummaryFab({ roomId, initial });
  const { ring } = fab;
  const bubbleId = useId();
  const root = useRef<HTMLDivElement>(null);
  const busy = ring.state === 'queued' || ring.state === 'running' || fab.starting;

  // The bubble closes on an outside tap or Escape
  useEffect(() => {
    if (!fab.bubbleOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) fab.closeBubble();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') fab.closeBubble();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [fab]);

  return (
    <>
      <div ref={root} className={styles.fab}>
        <ProgressRing ring={ring} />
        <button
          type="button"
          className={styles.button}
          onClick={fab.onClick}
          aria-busy={busy}
          aria-expanded={
            ring.state === 'queued' || ring.state === 'running' ? fab.bubbleOpen : undefined
          }
          aria-controls={fab.bubbleOpen ? bubbleId : undefined}
        >
          <ThinkingOrb
            state={busy ? 'working' : 'connecting'}
            size={32}
            theme="dark"
            speed={0.55}
            dots={1.5}
            opts={{ lineW: 4.4, thr: 1, signals: 8 }}
            className={styles.logo}
            aria-hidden
          />
          <span className="sr-only">{buttonName(ring)}</span>
        </button>
        {/* Shown only on hover or keyboard focus; the button's own name already says it */}
        {!fab.bubbleOpen && (
          <span className={styles.tooltip} aria-hidden="true">
            <span className={styles.label}>AI 채팅 요약</span>
          </span>
        )}
        {fab.bubbleOpen && (ring.state === 'queued' || ring.state === 'running') && (
          <div id={bubbleId} className={styles.bubble} role="group" aria-label="AI 요약 진행 상황">
            {/* One line, e.g. "요약 쓰는 중 ·   9/100" (user request 2026-11-10) */}
            <p className={styles.bubbleText}>
              {stageText(ring)}
              {ring.state === 'running' && (
                <>
                  {' · '}
                  {/* Three digits wide even for 9, so the bubble does not jump as it counts */}
                  <span className={styles.bubblePercent}>{ring.progress}</span>/100
                </>
              )}
            </p>
          </div>
        )}
        {/* Phase changes only, so the percentage does not chatter */}
        <p className="sr-only" role="status">
          {ring.state === 'queued' || ring.state === 'running' ? stageText(ring) : ''}
        </p>
      </div>
      <AiSummarySheet
        overlay={fab.panel}
        summary={fab.summary}
        actions={{
          sharing: fab.sharing,
          onShare: fab.share,
          onRenew: fab.askRenew,
        }}
      />
      <ConfirmDialog
        overlay={fab.renewConfirm}
        title="새로 요약할까요?"
        description="사용 횟수가 1회 차감돼요. 지금 요약은 새 요약으로 바뀌어요."
        confirmLabel="새로 요약하기"
        pending={fab.starting}
        onConfirm={fab.renew}
      />
    </>
  );
}

function ProgressRing({ ring }: { ring: AiSummaryRing }) {
  if (ring.state === 'idle') return null;
  const tone =
    ring.state === 'failed'
      ? styles.ringFailed
      : ring.state === 'queued'
        ? styles.ringQueued
        : styles.ringFill;
  const filled = ring.state === 'running' ? ring.progress : ring.state === 'queued' ? 25 : 100;
  return (
    // 50 units = the 40px button + 5px gap each side; r 23 keeps the 3-unit stroke clear of the button
    <svg className={styles.ring} viewBox="0 0 50 50" aria-hidden="true" focusable="false">
      <circle className={styles.ringTrack} cx="25" cy="25" r="23" pathLength={100} />
      <circle
        className={`${styles.ringValue} ${tone}`}
        cx="25"
        cy="25"
        r="23"
        pathLength={100}
        // A full circle drops the dash pattern, which left a hairline gap at 12 o'clock
        strokeDasharray={filled >= 100 ? undefined : '100'}
        strokeDashoffset={filled >= 100 ? undefined : 100 - filled}
      />
    </svg>
  );
}

function buttonName(ring: AiSummaryRing) {
  switch (ring.state) {
    case 'queued':
      return 'AI 채팅 요약, 순서를 기다리는 중';
    case 'running':
      return `AI 채팅 요약, ${ring.progress}% 진행 중`;
    case 'done':
      return 'AI 채팅 요약, 요약 결과 보기';
    case 'failed':
      return 'AI 채팅 요약, 요약하지 못했어요. 다시 요약하기';
    default:
      return 'AI 채팅 요약';
  }
}

function stageText(ring: Extract<AiSummaryRing, { state: 'queued' | 'running' }>) {
  if (ring.state === 'queued') {
    return ring.queueAhead > 0 ? `앞에 ${ring.queueAhead}건 기다리는 중` : '순서 기다리는 중';
  }
  return ring.phase === 'READING' ? '대화 읽는 중' : '요약 쓰는 중';
}
