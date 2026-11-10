'use client';

import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { Dialog } from 'radix-ui';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import { usePullRequestLiveUpdates, usePullRequestSheet, type PullRequestSheetProps } from './hook';
import styles from './PullRequestSheet.module.css';

function PullRequestLiveUpdates(props: Pick<PullRequestSheetProps, 'roomId' | 'login'>) {
  usePullRequestLiveUpdates(props);
  return null;
}

/** Figma 889:416 / 735:2891 — full-screen PR picker in the mobile app column. */
export function PullRequestSheet(props: PullRequestSheetProps) {
  const {
    overlay,
    state,
    setState,
    query,
    items,
    selected,
    select,
    external,
    canShare,
    share,
    shareError,
  } = usePullRequestSheet(props);

  return (
    <Dialog.Root open={overlay.isOpen} onOpenChange={overlay.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content className={styles.screen} aria-describedby={undefined}>
          <PullRequestLiveUpdates roomId={props.roomId} login={props.login} />

          <header className={styles.header}>
            <Dialog.Close type="button" className={styles.back}>
              <ArrowLeft aria-hidden className={styles.backIcon} />
              <span className="sr-only">뒤로</span>
            </Dialog.Close>
            <Dialog.Title className={styles.title}>PR 목록</Dialog.Title>
          </header>

          <div className={styles.tabs} role="group" aria-label="PR 상태">
            <button
              type="button"
              className={styles.tab}
              aria-pressed={state === 'open'}
              onClick={() => setState('open')}
            >
              열린 PR
            </button>
            <button
              type="button"
              className={styles.tab}
              aria-pressed={state === 'merged'}
              onClick={() => setState('merged')}
            >
              병합 된 PR
            </button>
          </div>

          <div className={styles.body}>
            {query.isPending ? (
              <Skeleton count={3} />
            ) : query.isError ? (
              <ErrorState onRetry={() => void query.refetch()} />
            ) : (
              <>
                <p className={styles.count}>
                  {state === 'open' ? '열린 PR' : '병합 된 PR'} {items.length}개
                </p>
                {items.length ? (
                  <ul
                    className={styles.list}
                    aria-label={state === 'open' ? '열린 PR 목록' : '병합 된 PR 목록'}
                  >
                    {items.map((pr) => (
                      <li key={pr.id}>
                        <article
                          className={styles.card}
                          data-selected={selected?.id === pr.id}
                          aria-labelledby={`pr-title-${pr.id}`}
                        >
                          <label className={styles.choice}>
                            <input
                              type="radio"
                              name="selected-pull-request"
                              checked={selected?.id === pr.id}
                              onChange={() => select(pr.id)}
                              aria-label={`${pr.repo} #${pr.number} ${pr.title} 선택`}
                            />
                            <span id={`pr-title-${pr.id}`} className={styles.cardTitle}>
                              #{pr.number} {pr.title}
                            </span>
                            <span className={styles.meta}>
                              <span title={pr.repo}>{pr.repo.split('/').at(-1)}</span>
                              {pr.githubUpdatedAt && (
                                <>
                                  <span className={styles.dot} aria-hidden />
                                  <RelativeTime value={pr.githubUpdatedAt} />
                                </>
                              )}
                            </span>
                            <span className={styles.event}>
                              담당자 {pr.author}님이{' '}
                              <span className={styles.eventAccent}>
                                PR {pr.state === 'merged' ? '병합' : '생성'}
                              </span>
                            </span>
                          </label>
                          <button
                            type="button"
                            className={styles.github}
                            onClick={() => external(pr.url)}
                          >
                            <Image
                              src="/images/chat-pull-requests/github.svg"
                              width={28}
                              height={28}
                              alt=""
                              aria-hidden
                              className={styles.githubIcon}
                            />
                            GitHub에서 열기
                            <span className="sr-only">
                              {' '}
                              · #{pr.number} {pr.title}
                            </span>
                          </button>
                        </article>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title={state === 'open' ? '열린 PR이 없어요.' : '병합된 PR이 없어요.'}
                  />
                )}
              </>
            )}
            {shareError && (
              <p role="alert" className={styles.error}>
                공유하지 못했어요. 다시 시도해 주세요.
              </p>
            )}
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.share}
              disabled={!canShare}
              onClick={share}
            >
              팀에 공유 하기
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
