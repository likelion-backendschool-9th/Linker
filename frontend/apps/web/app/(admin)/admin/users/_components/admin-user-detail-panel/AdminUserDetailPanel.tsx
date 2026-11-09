'use client';

import { ExternalLink, LockKeyhole, UserRound } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { toKst } from '@/lib/format/time';
import { STATUS_LABELS } from '../../_lib/admin-user-queries';
import type { ActionDraft } from '../admin-user-action-sheet/api';
import { SANCTION_LABELS, useAdminUserDetailPanel } from './hook';
import listStyles from '../admin-users-view/AdminUsersView.module.css';
import styles from './AdminUserDetailPanel.module.css';

const TABS = [
  ['basic', '기본정보'],
  ['sanctions', '제재 이력'],
  ['reports', '신고 내역'],
  ['payments', '결제 정보'],
] as const;
const date = (value: string) => format(toKst(value), 'yyyy.MM.dd');
export function AdminUserDetailPanel({
  userId,
  onDraft,
  draft,
}: {
  userId: string;
  onDraft?: (draft: ActionDraft) => void;
  draft?: ActionDraft;
}) {
  const { query, tab, setTab, step, reason, reasonError, handlers } = useAdminUserDetailPanel(
    userId,
    onDraft,
    draft,
  );
  if (query.isPending) return <Skeleton variant="card" count={2} />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const user = query.data;
  return (
    <div className={styles.panel}>
      <div className={styles.identity}>
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={48}
            height={48}
            sizes="48px"
            className={styles.avatar}
          />
        ) : (
          <span className={styles.avatarFallback}>
            <UserRound aria-hidden />
          </span>
        )}
        <div>
          <h2>
            {user.name} <span>@{user.login}</span>
          </h2>
          <p>
            {user.userType === 'DEVELOPER' ? '개발자' : '리크루터'} ·{' '}
            <span className={listStyles.status} data-status={user.status}>
              <span aria-hidden />
              {STATUS_LABELS[user.status]}
            </span>
          </p>
        </div>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="사용자 상세 정보">
        {TABS.map(([value, label], index) => (
          <button
            key={value}
            id={`user-tab-${value}`}
            role="tab"
            type="button"
            aria-selected={tab === value}
            aria-controls={`user-panel-${value}`}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % TABS.length
                  : event.key === 'ArrowLeft'
                    ? (index + TABS.length - 1) % TABS.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? TABS.length - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                setTab(TABS[next]![0]);
                document.getElementById(`user-tab-${TABS[next]![0]}`)?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`user-panel-${tab}`}
        aria-labelledby={`user-tab-${tab}`}
        tabIndex={0}
        className={styles.tabPanel}
      >
        {tab === 'basic' && (
          <dl className={styles.details}>
            <div>
              <dt>이름</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>이메일</dt>
              <dd className={styles.email}>
                {user.emailMasked ?? '—'}{' '}
                <button className={styles.outline} type="button" onClick={handlers.openEmail}>
                  <LockKeyhole size={16} aria-hidden />
                  사유 입력 후 열람
                </button>
              </dd>
            </div>
            <div>
              <dt>계정유형</dt>
              <dd>{user.userType === 'DEVELOPER' ? '개발자' : '리크루터'}</dd>
            </div>
            {user.recruiter && (
              <>
                <div>
                  <dt>소속회사</dt>
                  <dd>{user.recruiter.company}</dd>
                </div>
                <div>
                  <dt>메일 도메인</dt>
                  <dd>{user.recruiter.domain}</dd>
                </div>
                <div>
                  <dt>직무</dt>
                  <dd>{user.recruiter.jobTitle}</dd>
                </div>
                <div>
                  <dt>최근 30일 제안</dt>
                  <dd>
                    보냄 {user.recruiter.offersSent30d}건 · 수락 {user.recruiter.offersAccepted30d}
                    건
                  </dd>
                </div>
              </>
            )}
            <div>
              <dt>가입일</dt>
              <dd>
                <time dateTime={user.joinedAt}>{date(user.joinedAt)}</time>
              </dd>
            </div>
            {user.userType === 'DEVELOPER' && (
              <div>
                <dt>GitHub</dt>
                <dd>
                  <a
                    className={styles.link}
                    href={`https://github.com/${encodeURIComponent(user.login)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    github.com/{user.login} <ExternalLink size={16} aria-hidden />
                    <span className="sr-only"> (새 창)</span>
                  </a>
                </dd>
              </div>
            )}
          </dl>
        )}
        {tab === 'sanctions' &&
          (user.sanctions.length ? (
            <ul className={styles.history}>
              {user.sanctions.map((s) => (
                <li key={s.id}>
                  <div>
                    <strong>{SANCTION_LABELS[s.step] ?? s.step}</strong>
                    <span>{s.revokedAt ? '해제' : s.active ? '적용 중' : '종료'}</span>
                  </div>
                  <p>{s.reason ?? '—'}</p>
                  <time dateTime={s.startsAt}>{date(s.startsAt)}</time>
                  {s.endsAt && (
                    <>
                      {' '}
                      — <time dateTime={s.endsAt}>{date(s.endsAt)}</time>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>제재 내역이 없어요.</p>
          ))}
        {tab === 'reports' &&
          (user.reportHistory.length ? (
            <ul className={styles.history}>
              {user.reportHistory.map((report) => (
                <li key={report.caseId}>
                  <Link className={styles.link} href="/admin/reports?tab=reports&status=HANDLED">
                    신고 #{report.caseId}
                  </Link>
                  <p>
                    {report.targetType} · {report.result}
                  </p>
                  <time dateTime={report.at}>{date(report.at)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>접수된 신고가 없어요.</p>
          ))}
        {tab === 'payments' && (
          <>
            <h3>구독 정보</h3>
            {user.subscriptions.length ? (
              <ul className={styles.history}>
                {user.subscriptions.map((s) => (
                  <li key={s.id}>
                    <strong>{s.plan}</strong> · {s.status}
                    <p>
                      기간 종료 <time dateTime={s.periodEnd}>{date(s.periodEnd)}</time>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>구독 내역이 없어요.</p>
            )}
            <h3>결제 내역</h3>
            {user.payments.length ? (
              <ul className={styles.history}>
                {user.payments.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>{p.amount.toLocaleString('ko-KR')}원</strong>
                      <span>
                        {p.status === 'DONE'
                          ? '결제 완료'
                          : p.status === 'CANCELED'
                            ? '환불 완료'
                            : p.status}
                      </span>
                    </div>
                    {p.paidAt && <time dateTime={p.paidAt}>{date(p.paidAt)}</time>}
                    {p.refundedAmount > 0 && (
                      <p>환불 금액 {p.refundedAmount.toLocaleString('ko-KR')}원</p>
                    )}
                    <button
                      className={styles.outline}
                      type="button"
                      disabled={!user.allowedActions.refund || p.status !== 'DONE'}
                      onClick={() => handlers.openRefund(p.id)}
                    >
                      환불<span className="sr-only"> · 결제 {p.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>결제 내역이 없어요.</p>
            )}
          </>
        )}
      </div>
      <section className={styles.account} aria-labelledby="account-action-title">
        <h3 id="account-action-title">계정 조치</h3>
        <p className={styles.notice}>
          <LockKeyhole size={16} aria-hidden />
          영구제재와 해제는 리드 운영자만 할 수 있어요.
        </p>
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handlers.apply();
          }}
        >
          <label htmlFor="account-action-step">조치 유형</label>
          <select
            id="account-action-step"
            value={step}
            onChange={(event) => handlers.onStepChange(event.target.value)}
          >
            <option value="">조치 유형 선택</option>
            {['WARNING', 'DAYS_7', 'DAYS_30', 'PERMANENT'].map((value) => (
              <option
                key={value}
                value={value}
                disabled={value === 'PERMANENT' && !user.allowedActions.permanentSanction}
              >
                {SANCTION_LABELS[value]}
              </option>
            ))}
          </select>
          <label htmlFor="account-action-reason">조치 사유 (필수)</label>
          <div>
            <textarea
              id="account-action-reason"
              value={reason}
              onChange={(event) => handlers.onReasonChange(event.target.value)}
              placeholder="조치 사유를 입력하세요."
              required
              aria-invalid={reasonError}
              aria-describedby={reasonError ? 'account-reason-error' : 'account-reason-note'}
            />
            {reasonError && (
              <p id="account-reason-error" role="alert">
                사유를 입력해 주세요
              </p>
            )}
            <p id="account-reason-note" className={styles.meta}>
              조치 내용은 운영 로그에 기록됩니다.
            </p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.outline}
              disabled={
                !user.allowedActions.liftSanction ||
                !user.sanctions.some(
                  (s) => s.active && ['WARNING', 'DAYS_7', 'DAYS_30', 'PERMANENT'].includes(s.step),
                )
              }
              onClick={handlers.openLift}
            >
              제재 해제
            </button>
            <button className={styles.primary} type="submit" disabled={!step || !reason.trim()}>
              조치 적용
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
