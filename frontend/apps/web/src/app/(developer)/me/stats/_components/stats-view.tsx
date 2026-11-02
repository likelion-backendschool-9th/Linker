'use client';

// client boundary: account-scoped read queries and post selection
import { useQuery } from '@tanstack/react-query';
import { Eye, Heart, LockKeyhole, MessageCircle } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { parseAsString, useQueryState } from 'nuqs';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { useViewer } from '@/lib/auth/viewer-context';
import { formatDate } from '@/lib/format/time';
import { STATS } from '@/lib/policy';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { profileHref, statsPlanHref } from '@/lib/navigation/collaboration-links';

import {
  postStatsOptions,
  recruiterViewsOptions,
  statsSummaryOptions,
} from '../_lib/stats-queries';
import { StatsChart } from './stats-chart';
import { StatsFeaturedSheet } from './stats-featured-sheet';
import styles from './stats.module.css';

const SOURCES: Record<string, string> = {
  FEED: '피드',
  PROFILE: '프로필',
  RECRUIT_POST: '모집 글',
  CHAT_SHARE: '채팅 공유',
  EXTERNAL: '외부 링크',
  EXTERNAL_LINK: '외부 링크',
};

export function StatsView() {
  const viewer = useViewer();
  const featured = useOverlay('stats-featured');
  const summary = useQuery(statsSummaryOptions(viewer.login));
  const posts = useQuery({
    ...postStatsOptions(viewer.login),
    enabled: summary.data?.isPro === true && !summary.isFetching,
  });
  const recruiters = useQuery({
    ...recruiterViewsOptions(viewer.login),
    enabled: summary.data?.isPro === true && !summary.isFetching,
  });
  const [postId, setPost] = useQueryState('post', parseAsString);
  if (summary.isPending || summary.isFetching) return <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
    <Skeleton variant="card" count={3} />
  </LoadingIndicator>;
  if (summary.isError) return <ErrorState onRetry={() => void summary.refetch()} />;
  const selected =
    summary.data.items.find((p) => String(p.postId) === postId) ?? summary.data.items[0];
  const totals = summary.data.items.reduce(
    (acc, p) => ({
      likes: acc.likes + p.likeCount,
      comments: acc.comments + p.commentCount,
      views: acc.views + p.viewCount,
    }),
    { likes: 0, comments: 0, views: 0 },
  );
  const detail = posts.data?.items.find((p) => p.postId === selected?.postId);
  return (
    <div className={styles.stack}>
      <p className={styles.description}>
        내 작업물이 어디에서 관심을 받고 있는지 확인해요. 통계는 나에게만 보여요.
      </p>
      {viewer.login && (
        <div className={styles.heading}>
          <Button asChild variant="soft">
            <Link href={profileHref(viewer.login)}>내 프로필 보기</Link>
          </Button>
        </div>
      )}
      <dl className={styles.cards}>
        {[
          { label: '좋아요', value: totals.likes, Icon: Heart },
          { label: '댓글', value: totals.comments, Icon: MessageCircle },
          { label: '조회 수', value: totals.views, Icon: Eye },
        ].map(({ label, value, Icon }) => (
          <div className={styles.card} key={label}>
            <dt>
              <Icon aria-hidden />
              <span className={styles.description}>{label}</span>
            </dt>
            <dd className={styles.value}>{value.toLocaleString('ko-KR')}</dd>
          </div>
        ))}
      </dl>
      {!selected ? (
        <EmptyState
          title="아직 통계를 볼 작업물이 없어요."
          description="작업물을 올리면 좋아요, 댓글, 조회 수를 확인할 수 있어요."
        />
      ) : (
        <section className={styles.section} aria-labelledby="post-stats-title">
          <h2 id="post-stats-title" className={styles.title}>
            작업물별 통계
          </h2>
          <div className={styles.field}>
            <label htmlFor="stats-post">작업물 선택</label>
            <select
              id="stats-post"
              className={styles.input}
              value={selected.postId}
              onChange={(e) => void setPost(e.target.value)}
            >
              {summary.data.items.map((post) => (
                <option key={post.postId} value={post.postId}>
                  {post.intro}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.card}>
            <p>{selected.intro}</p>
            <p className={styles.description}>
              좋아요 {selected.likeCount} · 댓글 {selected.commentCount} · 조회 {selected.viewCount}
            </p>
            <Button asChild variant="soft">
              <Link href={`/posts/${selected.postId}` as Route}>작업물 보기</Link>
            </Button>
          </div>
        </section>
      )}
      {!summary.data.isPro ? (
        <section className={styles.locked} aria-labelledby="pro-stats-title">
          <LockKeyhole aria-hidden />
          <h2 id="pro-stats-title" className={styles.title}>
            내 작업물의 반응을 더 자세히
          </h2>
          <p>Pro에서 유입 경로, 최근 {STATS.trendDays}일 추이와 채용 담당자 조회 수를 확인해요.</p>
          <Button asChild>
            <Link href={statsPlanHref()}>Pro로 보기</Link>
          </Button>
        </section>
      ) : (
        <>
          <section className={styles.section} aria-labelledby="recruiter-stats-title">
            <h2 id="recruiter-stats-title" className={styles.title}>
              채용 담당자 조회
            </h2>
            {recruiters.isPending ? (
              <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
                <Skeleton />
              </LoadingIndicator>
            ) : recruiters.isError ? (
              <ErrorState onRetry={() => void recruiters.refetch()} />
            ) : (
              <>
                <p>이번 주 채용 담당자 {recruiters.data.thisWeek}명이 내 프로필을 봤어요.</p>
                <p className={styles.description}>누가 봤는지는 공개되지 않아요.</p>
                <StatsChart
                  title={`최근 ${STATS.recruiterWeeks}주 조회 수`}
                  summary={`최근 ${STATS.recruiterWeeks}주 동안 채용 담당자 조회 ${recruiters.data.weeks.reduce((n, w) => n + w.count, 0)}회`}
                  rows={recruiters.data.weeks.map((week) => ({
                    label: `${formatDate(week.weekStart)} 주`,
                    value: week.count,
                  }))}
                />
              </>
            )}
          </section>
          {selected && (
            <section className={styles.section} aria-labelledby="pro-post-title">
              <div className={styles.heading}>
                <h2 id="pro-post-title" className={styles.title}>
                  작업물 상세 통계
                </h2>
                <Button variant="outline" onClick={() => featured.open()}>
                  대표 작업물로 고정
                </Button>
              </div>
              {posts.isPending ? (
                <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
                  <Skeleton variant="card" />
                </LoadingIndicator>
              ) : posts.isError ? (
                <ErrorState onRetry={() => void posts.refetch()} />
              ) : detail ? (
                <>
                  <StatsChart
                    title="유입 경로"
                    summary={`조회 수 ${selected.viewCount}회 · 출처별로 확인해 보세요.`}
                    rows={detail.bySource.map((source) => ({
                      label: SOURCES[source.source] ?? source.source,
                      value: source.count,
                    }))}
                  />
                  <StatsChart
                    title={`최근 ${STATS.trendDays}일 조회 추이`}
                    summary={`표시 기간의 조회 수 ${detail.trend.reduce((n, day) => n + day.views, 0)}회`}
                    rows={detail.trend.map((day) => ({ label: day.date, value: day.views }))}
                    trend
                  />
                  <p className={styles.description}>README 펼침 {detail.readmeExpands}회</p>
                </>
              ) : (
                <EmptyState title="상세 통계가 아직 없어요." />
              )}
            </section>
          )}
        </>
      )}
      <StatsFeaturedSheet
        login={viewer.login}
        posts={summary.data.items}
        isPro={summary.data.isPro}
      />
    </div>
  );
}
