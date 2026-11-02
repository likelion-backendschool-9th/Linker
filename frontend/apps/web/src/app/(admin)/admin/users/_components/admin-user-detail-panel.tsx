'use client';

// own region: selected member's read-only details and action form navigation
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { OverlayLink } from '@/components/overlay/overlay-link';
import { collaborationLinks, profileHref } from '@/lib/navigation/collaboration-links';

import styles from '../../_components/admin-data.module.css';
import { adminUserOptions } from '../_lib/admin-user-queries';

const SANCTIONS: Record<string, string> = {
  WARNING: '경고',
  DAYS_7: '7일 이용 제한',
  DAYS_30: '30일 이용 제한',
  PERMANENT: '영구 정지',
};

export function AdminUserDetailPanel({ userId }: { userId: string }) {
  const query = useQuery(adminUserOptions(userId));
  const action = useOverlay('admin-user-action');
  const detail = useOverlay('admin-user-detail');
  if (query.isPending) return <Skeleton variant="card" count={2} />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const user = query.data;
  return (
    <div className={styles.stack}>
      <div className={styles.section}>
        <h2 className={styles.subtitle}>{user.name}</h2>
        <p className={styles.meta}>@{user.login}</p>
        <Button asChild variant="soft">
          <OverlayLink overlay={detail} href={profileHref(user.login)}>
            프로필 보기
          </OverlayLink>
        </Button>
      </div>
      <dl className={styles.details}>
        <div>
          <dt>이메일</dt>
          <dd>{user.emailMasked}</dd>
        </div>
        <div>
          <dt>가입일</dt>
          <dd>
            <time dateTime={user.joinedAt}>{formatDate(user.joinedAt)}</time>
          </dd>
        </div>
        <div>
          <dt>구독</dt>
          <dd>
            {user.subscription
              ? `${user.subscription.plan} · ${user.subscription.status === 'ACTIVE' ? '이용 중' : user.subscription.status}`
              : 'Free'}
          </dd>
        </div>
        <div>
          <dt>회원 유형</dt>
          <dd>{user.userType === 'DEVELOPER' ? '개발자' : '채용 담당자'}</dd>
        </div>
      </dl>
      {user.recruiter && (
        <section className={styles.section}>
          <h3 className={styles.subtitle}>채용 담당자 정보</h3>
          <dl className={styles.details}>
            <div>
              <dt>회사</dt>
              <dd>{user.recruiter.company}</dd>
            </div>
            <div>
              <dt>회사 메일 도메인</dt>
              <dd>@{user.recruiter.domain}</dd>
            </div>
            <div>
              <dt>직무</dt>
              <dd>{user.recruiter.jobTitle}</dd>
            </div>
            <div>
              <dt>최근 30일 채용 제안</dt>
              <dd>
                보냄 {user.recruiter.offersSent30d}건 · 수락 {user.recruiter.offersAccepted30d}건
              </dd>
            </div>
          </dl>
        </section>
      )}
      <section className={styles.section}>
        <h3 className={styles.subtitle}>제재 내역</h3>
        {user.sanctions.length ? (
          <ul className={styles.section}>
            {user.sanctions.map((s) => (
              <li key={s.id}>
                <p>{SANCTIONS[s.step] ?? s.step}</p>
                <p className={styles.note}>{s.reason}</p>
                <time className={styles.meta} dateTime={s.startsAt}>
                  {formatDate(s.startsAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.note}>제재 내역이 없어요.</p>
        )}
      </section>
      <section className={styles.section}>
        <h3 className={styles.subtitle}>신고 내역</h3>
        {user.reportHistory.length > 0 && (
          <Button asChild variant="soft">
            <OverlayLink overlay={detail} href={collaborationLinks.handledReports}>
              처리된 신고 목록 보기
            </OverlayLink>
          </Button>
        )}
        {user.reportHistory.length ? (
          <ul>
            {user.reportHistory.map((report) => (
              <li key={report.caseId} className={styles.note}>
                신고 #{report.caseId} · {report.result === 'HIDE' ? '숨김 처리' : report.result} ·{' '}
                <time dateTime={report.at}>{formatDate(report.at)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="접수된 신고가 없어요." />
        )}
      </section>
      <section className={styles.section}>
        <h3 className={styles.subtitle}>결제 내역</h3>
        {user.payments.length ? (
          <ul className={styles.section}>
            {user.payments.map((payment) => (
              <li key={payment.id}>
                <p>
                  {payment.amount.toLocaleString('ko-KR')}원 ·{' '}
                  {payment.status === 'PAID' ? '결제 완료' : payment.status}
                </p>
                <time className={styles.meta} dateTime={payment.paidAt}>
                  {formatDate(payment.paidAt)}
                </time>
                <Button
                  variant="outline"
                  disabled={!user.allowedActions.refund || payment.status !== 'PAID'}
                  onClick={() => action.open(`refund:${userId}:${payment.id}`)}
                >
                  환불<span className="sr-only"> · 결제 {payment.id}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.note}>결제 내역이 없어요.</p>
        )}
      </section>
      <div className={styles.actions}>
        <Button variant="outline" onClick={() => action.open(`sanction:${userId}`)}>
          제재하기
        </Button>
        <Button variant="outline" onClick={() => action.open(`email:${userId}`)}>
          이메일 전체 보기
        </Button>
        <Button
          variant="outline"
          disabled={!user.allowedActions.liftSanction || !user.sanctions.length}
          aria-describedby="lift-permission-note"
          onClick={() => action.open(`lift:${userId}`)}
        >
          제재 해제 · 리드 운영자
        </Button>
      </div>
      <p id="lift-permission-note" className={styles.note}>
        {!user.allowedActions.liftSanction
          ? '제재 해제는 리드 운영자만 할 수 있어요.'
          : !user.sanctions.length
            ? '해제할 제재가 없어요.'
            : '제재 해제 전 대상과 사유를 확인해 주세요.'}
      </p>
    </div>
  );
}
