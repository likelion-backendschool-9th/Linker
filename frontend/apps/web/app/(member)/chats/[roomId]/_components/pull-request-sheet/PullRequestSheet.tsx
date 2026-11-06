'use client';

// overlay: team PR list with URL state and read-only query
import { GitMerge, GitPullRequest } from 'lucide-react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { GitHubMark } from '@/features/github/github-mark/GithubMark';

import styles from '../pull-requests.module.css';

import { usePullRequestSheet } from './hook';

export function PullRequestSheet({ roomId, login }: { roomId: number; login: string | null }) {
  const { overlay, state, setState, external, query } = usePullRequestSheet({ roomId, login });

  return (
    <OverlaySheet
      overlay={overlay}
      title="Pull requests"
      description="팀에 연결된 레포의 PR을 확인해요."
    >
      <div className={styles.stack}>
        <div className={styles.tabs} role="group" aria-label="PR 상태">
          <button
            type="button"
            aria-pressed={state === 'open'}
            onClick={() => void setState('open')}
          >
            열림
          </button>
          <button
            type="button"
            aria-pressed={state === 'merged'}
            onClick={() => void setState('merged')}
          >
            병합됨
          </button>
        </div>
        {query.isPending ? (
          <Skeleton count={3} />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : query.data.items.length ? (
          <ul>
            {query.data.items.map((pr) => (
              <li key={pr.url} className={styles.item}>
                <div className={styles.row}>
                  {pr.state === 'merged' ? (
                    <GitMerge aria-hidden />
                  ) : (
                    <GitPullRequest aria-hidden />
                  )}
                  <div className={styles.body}>
                    <p className={styles.title}>{pr.title}</p>
                    <p className={styles.meta}>
                      {new URL(pr.url).pathname.split('/').slice(1, 3).join('/')} · #{pr.number} ·{' '}
                      {pr.author}
                    </p>
                    <span className={styles.meta}>
                      {pr.state === 'merged' ? '병합됨' : '열림'}
                    </span>
                  </div>
                </div>
                <Button variant="outline" onClick={() => external(pr.url)}>
                  <GitHubMark />
                  GitHub에서 열기<span className="sr-only"> · {pr.title}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={state === 'open' ? '열린 PR이 없어요.' : '병합된 PR이 없어요.'} />
        )}
      </div>
    </OverlaySheet>
  );
}
