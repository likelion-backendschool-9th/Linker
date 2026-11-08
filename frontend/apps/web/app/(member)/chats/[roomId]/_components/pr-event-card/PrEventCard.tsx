'use client';

// client boundary: external GitHub link; system events expose no edit/delete actions
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import { GitHubMark } from '@/features/github/github-mark/GithubMark';

import type { RoomMessage } from '../../_lib/room-api';
import styles from './PrEventCard.module.css';

/** Event line of the card. OPENED is the Figma copy; the other three follow its wording. */
const EVENTS = {
  OPENED: 'PR이 생성 되었습니다',
  REVIEW_REQUESTED: '리뷰가 요청 되었습니다',
  MERGED: 'PR이 병합 되었습니다',
  CLOSED: 'PR이 닫혔습니다',
} as const;

/** Figma 248:1223: GitHub mark, blue event line, "#10 title", "repo · 2시간 전". Tap opens GitHub. */
export function PrEventCard({ message }: { message: RoomMessage }) {
  const openExternal = useOpenExternal();
  const payload = message.payload;
  const event =
    typeof payload?.event === 'string' && payload.event in EVENTS
      ? EVENTS[payload.event as keyof typeof EVENTS]
      : 'GitHub PR 알림';
  const number = typeof payload?.prNumber === 'number' ? `#${payload.prNumber} ` : '';
  const url = typeof payload?.url === 'string' ? payload.url : null;
  const content = (
    <>
      <GitHubMark className={styles.mark} />
      <span className={styles.body}>
        <span className={styles.event}>{event}</span>
        <span className={styles.title}>
          {number}
          {message.text}
        </span>
        <span className={styles.meta}>
          {typeof payload?.repo === 'string' && (
            <>
              <span>{payload.repo}</span>
              <span className={styles.dot} aria-hidden />
            </>
          )}
          <RelativeTime value={message.createdAt} />
        </span>
      </span>
    </>
  );
  return url ? (
    <button type="button" className={styles.card} onClick={() => openExternal(url)}>
      {content}
      <span className="sr-only">GitHub에서 열기</span>
    </button>
  ) : (
    <div className={styles.card}>{content}</div>
  );
}
