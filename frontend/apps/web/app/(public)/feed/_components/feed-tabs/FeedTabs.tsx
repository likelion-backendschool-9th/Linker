'use client';

import { useRef, type KeyboardEvent } from 'react';

import type { FeedTab } from '../../_lib/feed-queries';
import styles from './FeedTabs.module.css';

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'recommended', label: '추천' },
  { key: 'following', label: '팔로잉' },
];

export const feedTabId = (idBase: string, tab: FeedTab) => `${idBase}-tab-${tab}`;
export const feedPanelId = (idBase: string) => `${idBase}-panel`;

/**
 * 24 "추천" / "팔로잉" (Figma 785:1211): two halves under the header, 2px line under each — slate
 * for the current one, light gray for the other. They pin to the top with the header collapse (19).
 */
export function FeedTabs({
  idBase,
  current,
  onChange,
}: {
  idBase: string;
  current: FeedTab;
  onChange: (tab: FeedTab) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // ← / → move between the two tabs (WAI-ARIA tabs pattern)
  function onKeyDown(event: KeyboardEvent, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    onChange(TABS[next]!.key);
    buttons.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label="피드 종류" className={styles.tabs}>
      {TABS.map((tab, index) => (
        <button
          key={tab.key}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          type="button"
          role="tab"
          id={feedTabId(idBase, tab.key)}
          aria-selected={current === tab.key}
          aria-controls={feedPanelId(idBase)}
          tabIndex={current === tab.key ? 0 : -1}
          className={styles.tab}
          onClick={() => onChange(tab.key)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
