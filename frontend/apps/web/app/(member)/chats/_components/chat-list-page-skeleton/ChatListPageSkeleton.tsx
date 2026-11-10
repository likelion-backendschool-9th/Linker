'use client';

import { useLoaderPresence } from '@/components/ui/page-loading';

import { CHAT_TABS } from '../chat-list/api';
import { LABELS } from '../chat-list/hook';
import styles from './ChatListPageSkeleton.module.css';

/** Figma 999:479 "16-스켈레톤" — 팀/개인/요청 tabs + one room avatar/title/preview bones. */
export function ChatListPageSkeleton() {
  useLoaderPresence();

  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        불러오는 중이에요
      </p>
      <nav aria-label="채팅 종류" className={styles.tabs}>
        {CHAT_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={tab === 'TEAM'}
            className={styles.tab}
            tabIndex={-1}
          >
            {LABELS[tab]}
          </button>
        ))}
      </nav>
      <div className={styles.content} aria-hidden>
        <div className={styles.row}>
          <span className={`${styles.bone} ${styles.avatar}`} />
          <div className={styles.body}>
            <span className={`${styles.bone} ${styles.title}`} />
            <span className={`${styles.bone} ${styles.preview}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
