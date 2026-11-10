'use client';

import { useState } from 'react';

import styles from './AiSummaryBanner.module.css';

/**
 * Policy banner for the first 7 days. No Figma — confirm with 준호.
 * shortcut: server `aiSummaryBanner` (team.createdAt window); dismiss is session-local.
 */
export function AiSummaryBanner({ teamId, visible }: { teamId: number; visible: boolean }) {
  const key = `ai-summary-banner:${teamId}`;
  const [hidden, setHidden] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(key) === '1';
  });
  if (!visible || hidden) return null;
  return (
    <div className={styles.banner} role="status">
      <p className={styles.text}>이 팀은 AI 요약을 사용해요</p>
      <button
        type="button"
        className={styles.close}
        aria-label="배너 닫기"
        onClick={() => {
          sessionStorage.setItem(key, '1');
          setHidden(true);
        }}
      >
        닫기
      </button>
    </div>
  );
}
