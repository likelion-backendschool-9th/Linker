'use client';

// client boundary: status counts and the Flex trend come from TanStack Query
import { ArrowLeftToLineBrokenIcon } from '@solar-icons/static/broken/arrow-left-to-line';
import { CheckBrokenIcon } from '@solar-icons/static/broken/check';
import { CloseBrokenIcon } from '@solar-icons/static/broken/close';
import { LoaderBrokenIcon } from '@solar-icons/static/broken/loader';

import { ApiError } from '@/lib/api/api-error';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import { PROGRESS_STATUSES, useIssueProgress, type ProgressStatus } from './hook';
import styles from './IssueProgress.module.css';
import { IssueTrendChart } from './IssueTrendChart';

/** Card copy and icon per status (Figma 11 "이슈 진행 카드"). The status word is always written out. */
// Icon sizes follow the Figma frames: 24 (check, arrow), 20 (loader), 22 (close)
const CARDS: Record<ProgressStatus, { word: string; icon: string; tone: string; size: string }> = {
  DONE: { word: '완료', icon: CheckBrokenIcon, tone: 'done', size: 'iconMd' },
  IN_PROGRESS: { word: '진행', icon: LoaderBrokenIcon, tone: 'active', size: 'iconSm' },
  BLOCKED: { word: '정지', icon: CloseBrokenIcon, tone: 'blocked', size: 'iconXm' },
  TODO: { word: '작업 전', icon: ArrowLeftToLineBrokenIcon, tone: 'todo', size: 'iconMd' },
};

type IssueProgressProps = {
  teamId: string;
  /** Flex team (POL-T-7): only then the 14-day trend is shown */
  flex: boolean;
};

/**
 * Top of 11 (Figma 197:66): "전체 이슈 N개" with four status cards for every team, then the
 * Flex-only "최근 추이" chart. Free teams see no chart (user decision 2026-11-08; Figma has no Flex prompt).
 */
export function IssueProgress({ teamId, flex }: IssueProgressProps) {
  const { total, counts, ready, failed, retry, progress } = useIssueProgress(teamId, flex);
  const showTrend =
    flex &&
    !(progress.error instanceof ApiError && progress.error.code === 'PLAN_LIMIT');

  return (
    <>
      <section aria-labelledby="issue-progress-title" className={styles.band}>
        <h2 id="issue-progress-title" className={styles.title}>
          전체 이슈 <span className={styles.total}>{ready ? `${total}개` : ''}</span>
        </h2>
        {failed && !ready ? (
          <ErrorState onRetry={retry} />
        ) : !ready ? (
          <Skeleton count={2} />
        ) : (
          <ul className={styles.cards}>
            {PROGRESS_STATUSES.map((status) => {
              const card = CARDS[status];
              return (
                <li key={status} className={styles.card}>
                  <span
                    aria-hidden
                    className={`${styles.icon} ${styles[card.size]}`}
                    dangerouslySetInnerHTML={{ __html: card.icon }}
                  />
                  <p className={styles.text}>
                    {total}개의 이슈 중{' '}
                    <span className={styles[card.tone]}>
                      {counts[status]}개 {card.word}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {showTrend && (
        <>
          <section aria-labelledby="issue-trend-title" className={styles.trend}>
            <h2 id="issue-trend-title" className={styles.trendTitle}>
              최근 추이 <span className={styles.period}>근 2주</span>
            </h2>
            {progress.isPending ? (
              <Skeleton count={3} />
            ) : progress.isError ? (
              <ErrorState onRetry={() => void progress.refetch()} />
            ) : (
              <IssueTrendChart history={progress.data.history} />
            )}
          </section>
          <hr className={styles.divider} />
        </>
      )}
    </>
  );
}
