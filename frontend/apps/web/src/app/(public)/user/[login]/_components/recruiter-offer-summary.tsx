'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/api-fetch';

import styles from './profile.module.css';

type OfferDeveloper = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string | null;
};

type OfferSummary = {
  talkingCount: number;
  waitingCount: number;
  todayUsed: number;
  todayLimit: number;
  scoutTodayLimit: number;
  scoutSubscribed: boolean;
  latest: {
    roomId: number;
    developer: OfferDeveloper | null;
    status: 'TALKING' | 'WAITING' | 'NO_RESPONSE';
    sentAt: string;
  }[];
};

const STATUS_LABEL = {
  TALKING: '대화 중',
  WAITING: '응답 대기',
  NO_RESPONSE: '응답 없음',
} as const;

export function RecruiterOfferSummary() {
  const summary = useQuery({
    queryKey: ['recruiter-offer-summary'],
    queryFn: () => apiFetch<OfferSummary>('/api/v1/recruiter/offers/summary'),
  });

  const limit = summary.data
    ? summary.data.scoutSubscribed
      ? summary.data.scoutTodayLimit
      : summary.data.todayLimit
    : 0;
  const remaining = summary.data ? Math.max(0, limit - summary.data.todayUsed) : 0;

  return (
    <section className={`${styles.section} ${styles.span}`} aria-labelledby="offers-title">
      <h2 id="offers-title">보낸 채용 제안</h2>
      {summary.isPending ? (
        <p role="status">제안 요약을 불러오고 있어요.</p>
      ) : summary.isError ? (
        <div>
          <p role="alert">제안 요약을 불러오지 못했어요.</p>
          <Button variant="outline" onClick={() => void summary.refetch()}>
            다시 시도
          </Button>
        </div>
      ) : (
        <>
          <p className={styles.offerStats}>
            <span>대화 중 {summary.data.talkingCount}</span>
            <span>응답 대기 {summary.data.waitingCount}</span>
            <span>
              오늘 남은 제안 {remaining}/{limit}
            </span>
          </p>
          {summary.data.latest.length === 0 ? (
            <p className={styles.empty}>아직 보낸 채용 제안이 없어요</p>
          ) : (
            <ul className={styles.offerList}>
              {summary.data.latest.map((offer) => (
                <li key={offer.roomId}>
                  {offer.developer?.login ? (
                    <Link className={styles.offerPerson} href={`/user/${encodeURIComponent(offer.developer.login)}`}>
                      <span>{offer.developer.name}</span>
                      <span className={styles.handle}>@{offer.developer.login}</span>
                      <span className={styles.badge}>{STATUS_LABEL[offer.status]}</span>
                    </Link>
                  ) : (
                    <p>볼 수 없는 사용자</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p>
            <Link className={styles.actionButton} href="/recruiter/offers">
              전체 보기
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
