'use client';

// client boundary: external GitHub link; system events expose no edit/delete actions
import { GitMerge, GitPullRequest, GitPullRequestClosed, UserRoundCheck } from 'lucide-react';

import { Button } from '@/components/ui/button/Button';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import { GitHubMark } from '@/features/github/github-mark/GithubMark';

import type { RoomMessage } from '../../_lib/room-api';
import styles from '../pull-requests.module.css';

const EVENTS = {
  OPENED: { label: 'PR 열림', Icon: GitPullRequest },
  REVIEW_REQUESTED: { label: '리뷰 요청', Icon: UserRoundCheck },
  MERGED: { label: 'PR 병합됨', Icon: GitMerge },
  CLOSED: { label: 'PR 닫힘', Icon: GitPullRequestClosed },
};

export function PrEventCard({ message }: { message: RoomMessage }) {
  const openExternal = useOpenExternal();
  const payload = message.payload;
  const event =
    typeof payload?.event === 'string' && payload.event in EVENTS
      ? EVENTS[payload.event as keyof typeof EVENTS]
      : null;
  return (
    <div className={styles.event}>
      <p className={styles.row}>
        <GitHubMark />
        <span>GitHub</span>
        {event && (
          <span className={styles.badge}>
            <event.Icon aria-hidden />
            {event.label}
          </span>
        )}
      </p>
      <p className={styles.title}>{message.text}</p>
      {typeof payload?.repo === 'string' && (
        <p className={styles.meta}>
          {payload.repo}
          {typeof payload.prNumber === 'number' && ` · #${payload.prNumber}`}
        </p>
      )}
      {typeof payload?.url === 'string' && (
        <Button variant="outline" onClick={() => openExternal(payload.url as string)}>
          GitHub에서 열기
        </Button>
      )}
    </div>
  );
}
