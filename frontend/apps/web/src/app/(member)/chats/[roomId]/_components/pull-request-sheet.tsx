'use client';

// overlay: team PR list with URL state and read-only query
import { useQuery } from '@tanstack/react-query';
import { GitMerge, GitPullRequest } from 'lucide-react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import { GitHubMark } from '@/features/github/github-mark';
import { apiFetch } from '@/lib/api/api-fetch';
import { useOverlay } from '@/lib/navigation/use-overlay';

import styles from './pull-requests.module.css';

type PullRequest = {
  number: number;
  title: string;
  state: 'open' | 'merged';
  author: string;
  url: string;
};

export function PullRequestSheet({ roomId, login }: { roomId: number; login: string | null }) {
  const overlay = useOverlay('chat-pull-requests');
  const [state, setState] = useQueryState(
    'pr',
    parseAsStringLiteral(['open', 'merged'] as const).withDefault('open'),
  );
  const external = useOpenExternal();
  const query = useQuery({
    queryKey: ['chat', login, 'room', roomId, 'pull-requests', state],
    queryFn: ({ signal }) =>
      apiFetch<{ items: PullRequest[] }>(
        `/api/v1/user/chat-rooms/${roomId}/pull-requests?state=${state}`,
        { signal },
      ),
    enabled: overlay.isOpen,
    staleTime: 0,
  });
  return (
    <>
      <Button variant="soft" onClick={() => overlay.open()}>
        <GitPullRequest aria-hidden />
        PR 목록
      </Button>
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
            <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
              <Skeleton count={3} />
            </LoadingIndicator>
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
    </>
  );
}
