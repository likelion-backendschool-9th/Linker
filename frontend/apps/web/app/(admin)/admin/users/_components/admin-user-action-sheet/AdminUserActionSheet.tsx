'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { formatDate } from '@/lib/format/time';
import { SUBSCRIPTION_RULES } from '@/lib/policy';
import { SANCTION_LABELS } from '../../_lib/admin-user-queries';
import type { ActionDraft, AdminUserDetail } from './api';
import { ACTION_TITLES, useAdminActionForm, useAdminUserActionSheet } from './hook';
import styles from './AdminUserActionSheet.module.css';

export function AdminUserActionSheet({
  draft,
  onApplied,
}: {
  draft?: ActionDraft;
  onApplied?: () => void;
}) {
  const { overlay, kind, paymentId, user, validId } = useAdminUserActionSheet();
  return (
    <OverlaySheet
      overlay={overlay}
      title={ACTION_TITLES[kind] ?? '운영 조치'}
      description={
        kind === 'email'
          ? '이메일 전체 열람은 사유와 함께 운영 로그에 기록됩니다.'
          : kind === 'refund'
            ? '대상 결제와 환불 조건을 확인하세요.'
            : '대상과 조치 내용을 확인하세요.'
      }
    >
      {!validId ? (
        <p role="alert">회원을 찾지 못했어요.</p>
      ) : user.isPending ? (
        <Skeleton />
      ) : user.isError ? (
        <ErrorState onRetry={() => void user.refetch()} />
      ) : (
        <AdminActionForm
          key={overlay.id}
          user={user.data}
          kind={kind}
          paymentId={paymentId}
          draft={draft}
          close={overlay.close}
          onApplied={onApplied}
        />
      )}
    </OverlaySheet>
  );
}
function AdminActionForm(props: {
  user: AdminUserDetail;
  kind: string;
  paymentId?: string;
  draft?: ActionDraft;
  close: () => void;
  onApplied?: () => void;
}) {
  const { user, kind, close } = props;
  const {
    reason,
    setReason,
    step,
    setStep,
    sanctionId,
    setSanctionId,
    activeSanctions,
    confirmed,
    setConfirmed,
    invalid,
    setInvalid,
    reasonRef,
    confirmationRef,
    payment,
    denied,
    mutation,
    submit,
  } = useAdminActionForm(props);
  const label = kind === 'email' ? '열람 사유' : '제재 사유';
  const email = kind === 'email' && mutation.isSuccess ? mutation.data?.email : undefined;
  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <p className={styles.target}>
        {user.name} · @{user.login}
      </p>
      {kind === 'sanction' && (
        <div className={styles.field}>
          <label htmlFor="sanction-step">제재 단계</label>
          <select id="sanction-step" value={step} onChange={(e) => setStep(e.target.value)}>
            {['WARNING', 'DAYS_7', 'DAYS_30', 'PERMANENT'].map((value) => (
              <option
                key={value}
                value={value}
                disabled={value === 'PERMANENT' && !user.allowedActions.permanentSanction}
              >
                {SANCTION_LABELS[value]}
                {value === 'PERMANENT' ? ' · 리드 운영자만 가능' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      {kind === 'lift' && (
        <>
          <div className={styles.field}>
            <label htmlFor="lift-sanction">해제할 제재</label>
            <select
              id="lift-sanction"
              value={sanctionId}
              disabled={denied}
              onChange={(e) => setSanctionId(e.target.value)}
            >
              {activeSanctions.map((s) => (
                <option key={s.id} value={s.id}>
                  {SANCTION_LABELS[s.step]} · {formatDate(s.startsAt)} · {s.reason}
                </option>
              ))}
            </select>
          </div>
          {denied && <p>제재 해제는 리드 운영자만 할 수 있어요.</p>}
          <label className={styles.consent}>
            <input
              ref={confirmationRef}
              type="checkbox"
              checked={confirmed}
              onChange={(e) => {
                setConfirmed(e.target.checked);
                setInvalid(false);
              }}
              aria-invalid={invalid}
              aria-describedby={invalid ? 'admin-confirm-error' : undefined}
            />
            대상과 해제할 제재를 확인했어요
          </label>
          {invalid && (
            <p id="admin-confirm-error" role="alert" className={styles.error}>
              해제할 제재를 확인해 주세요.
            </p>
          )}
        </>
      )}
      {kind === 'refund' && (
        <>
          {payment ? (
            <p>
              결제 #{payment.id} · {payment.amount.toLocaleString('ko-KR')}원
            </p>
          ) : (
            <p>환불할 결제를 찾지 못했어요.</p>
          )}
          <p>
            결제 후 {SUBSCRIPTION_RULES.refundWithinDays}일 이내이며 혜택을 사용하지 않은 경우 전액
            환불해요. 최종 환불 가능 여부는 서버에서 확인해요.
          </p>
          <p role="status">현재 환불을 처리할 수 없어요.</p>
        </>
      )}
      {(kind === 'email' || kind === 'sanction') && (
        <div className={styles.field}>
          <label htmlFor="admin-action-reason">{label} (필수)</label>
          <textarea
            id="admin-action-reason"
            ref={reasonRef}
            value={reason}
            required
            disabled={mutation.isPending || mutation.isSuccess}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'admin-reason-error' : undefined}
            placeholder="근거와 판단 이유를 입력하세요."
            onChange={(e) => {
              setReason(e.target.value);
              setInvalid(false);
            }}
          />
          {invalid && (
            <p id="admin-reason-error" role="alert" className={styles.error}>
              사유를 입력해 주세요
            </p>
          )}
        </div>
      )}
      {kind === 'email' && (
        <p className={styles.email} role={mutation.isSuccess ? 'status' : undefined}>
          {mutation.isSuccess
            ? (email ?? '등록된 이메일이 없어요.')
            : (user.emailMasked ?? '등록된 이메일이 없어요.')}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className={styles.error}>
          {mutation.error.message}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.outline}
          onClick={close}
          disabled={mutation.isPending}
        >
          {mutation.isSuccess ? '닫기' : '취소'}
        </button>
        {!mutation.isSuccess && (
          <button className={styles.primary} type="submit" disabled={denied || mutation.isPending}>
            {mutation.isPending
              ? '처리 중…'
              : kind === 'email'
                ? '사유 기록 후 열람'
                : kind === 'lift'
                  ? '제재 해제'
                  : kind === 'refund'
                    ? '환불 실행'
                    : '제재 적용'}
          </button>
        )}
      </div>
    </form>
  );
}
